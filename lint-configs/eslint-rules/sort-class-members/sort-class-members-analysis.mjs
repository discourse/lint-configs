/**
 * @fileoverview Read-only analysis for the `sort-class-members` rule: member
 * classification, slot matching, and out-of-order detection.
 *
 * Ported from `eslint-plugin-sort-class-members` v1.22.1 (MIT). The matching
 * and scoring semantics are unchanged so existing `order`/`groups`
 * configuration keeps meaning the same thing.
 */

/**
 * @typedef {object} Slot
 * @property {number} index Position of the slot in the expanded order.
 * @property {number} score How specifically the member matched the slot.
 * @property {string} [sort] `"alphabetical"` when the slot sorts by name.
 */

/**
 * @typedef {object} MemberInfo
 * @property {string} id Index of the member in the class body, as a string.
 * @property {string} name Member name; `#` prefixed for private identifiers.
 * @property {"method"|"property"} type
 * @property {string[]} decorators Decorator names applied to the member.
 * @property {boolean} static
 * @property {boolean} abstract
 * @property {boolean} override
 * @property {boolean} readonly
 * @property {boolean} async
 * @property {boolean} private `true` for `#` members.
 * @property {string} accessibility TypeScript accessibility modifier.
 * @property {string} kind `get`, `set`, `constructor`, or `method`.
 * @property {string} [propertyType] AST type of a property's value or annotation.
 * @property {import("estree").Node} node
 * @property {string} [matchingAccessor] Id of the paired getter/setter.
 * @property {boolean} [isFirstAccessor] `true` on the first accessor of a pair.
 * @property {Slot[]} acceptableSlots Top-scoring slots, highest index first.
 */

/**
 * @typedef {object} Problem
 * @property {MemberInfo} source The member that is out of place.
 * @property {MemberInfo} target The member it should be positioned against.
 * @property {"before"|"after"} expected
 */

const builtInGroups = {
  constructor: { name: "constructor", type: "method" },
  properties: { type: "property" },
  getters: { kind: "get" },
  setters: { kind: "set" },
  "accessor-pairs": { accessorPair: true },
  "static-properties": { type: "property", static: true },
  "conventional-private-properties": { type: "property", name: "/_.+/" },
  "arrow-function-properties": { propertyType: "ArrowFunctionExpression" },
  methods: { type: "method" },
  "static-methods": { type: "method", static: true },
  "async-methods": { type: "method", async: true },
  "conventional-private-methods": { type: "method", name: "/_.+/" },
  "everything-else": {},
};

const comparers = [
  { property: "name", value: 100, test: (m, s) => s.testName(m.name) },
  { property: "type", value: 10, test: (m, s) => s.type === m.type },
  { property: "static", value: 10, test: (m, s) => s.static === m.static },
  { property: "async", value: 10, test: (m, s) => s.async === m.async },
  { property: "private", value: 10, test: (m, s) => s.private === m.private },
  {
    property: "accessibility",
    value: 10,
    test: (m, s) => s.accessibility === m.accessibility,
  },
  {
    property: "abstract",
    value: 10,
    test: (m, s) => s.abstract === m.abstract,
  },
  {
    property: "override",
    value: 10,
    test: (m, s) => s.override === m.override,
  },
  {
    property: "readonly",
    value: 10,
    test: (m, s) => s.readonly === m.readonly,
  },
  {
    property: "kind",
    value: 10,
    test: (m, s) => {
      if (s.kind === "accessor") {
        return isAccessor(m);
      } else if (s.kind === "nonAccessor") {
        return !isAccessor(m);
      } else {
        return s.kind === m.kind;
      }
    },
  },
  {
    property: "groupByDecorator",
    value: 10,
    test: (m, s) => {
      if (typeof s.groupByDecorator === "boolean") {
        return s.groupByDecorator === m.decorators.length > 0;
      }
      const comparer = getStringComparer(s.groupByDecorator);
      return m.decorators.some((decorator) => comparer(decorator));
    },
  },
  {
    property: "accessorPair",
    value: 20,
    test: (m, s) =>
      (s.accessorPair && !!m.matchingAccessor) ||
      (s.accessorPair === false && !m.matchingAccessor),
  },
  {
    property: "propertyType",
    value: 12,
    test: (m, s) => m.type === "property" && s.propertyType === m.propertyType,
  },
];

/**
 * Expands the configured `order` into a flat list of slot matchers.
 *
 * @param {Array<string|object>} order The configured order.
 * @param {object} groups Custom groups, merged over the built-in ones.
 * @returns {object[]} Flat, ordered slot matchers.
 */
export function getExpectedOrder(order, groups) {
  const allGroups = { ...builtInGroups, ...groups };
  return order.flatMap((slot) => expandSlot(slot, allGroups));
}

function expandSlot(input, groups) {
  if (Array.isArray(input)) {
    return input.flatMap((x) => expandSlot(x, groups));
  }

  let slot;
  if (typeof input === "string") {
    slot = input[0] === "[" ? { group: input.slice(1, -1) } : { name: input };
  } else {
    slot = { ...input };
  }

  if (slot.group) {
    if (Object.hasOwn(groups, slot.group)) {
      return expandSlot(groups[slot.group], groups);
    }
    // Unknown groups are ignored, as upstream does.
    return [];
  }

  if (slot.name) {
    slot.testName = getStringComparer(slot.name);
  }

  return [slot];
}

/**
 * Builds a `MemberInfo` for every keyed member of a class (or interface)
 * body, including accessor pairing and slot matching. Members without a key
 * (`static {}` blocks, index signatures, `<template>` tags) are skipped.
 *
 * @param {import("estree").Node} classNode The class or interface node.
 * @param {import("eslint").SourceCode} sourceCode
 * @param {object[]} orderedSlots Result of `getExpectedOrder`.
 * @returns {MemberInfo[]} Members in source order.
 */
export function getClassMemberInfos(classNode, sourceCode, orderedSlots) {
  const members = classNode.body.body
    .filter((node) => node.key)
    .map((node, i) => ({ ...getMemberInfo(node, sourceCode), id: String(i) }));

  matchAccessorPairs(members);

  for (const member of members) {
    member.acceptableSlots = getAcceptableSlots(member, orderedSlots);
  }

  return members;
}

function getMemberInfo(node, sourceCode) {
  const isPrivate =
    node.key.type === "PrivateName" || node.key.type === "PrivateIdentifier";
  const decorators = (node.decorators || []).map((decorator) =>
    decorator.expression.type === "CallExpression"
      ? decorator.expression.callee.name
      : decorator.expression.name
  );
  const abstract =
    node.type === "TSAbstractAccessorProperty" ||
    node.type === "TSAbstractPropertyDefinition" ||
    node.type === "TSAbstractMethodDefinition";

  let name;
  let type;
  let propertyType;
  let async = false;

  if (
    node.type === "ClassProperty" ||
    node.type === "ClassPrivateProperty" ||
    node.type === "PropertyDefinition" ||
    node.type === "PrivateIdentifier" ||
    node.type === "TSAbstractPropertyDefinition" ||
    node.type === "TSPropertySignature"
  ) {
    type = "property";

    if (isPrivate) {
      name = `#${node.key.id ? node.key.id.name : node.key.name}`;
    } else {
      const [first, second] = sourceCode.getFirstTokens(node.key, 2);
      name =
        second && second.type === "Identifier" ? second.value : first.value;
    }

    if (node.typeAnnotation) {
      propertyType = node.typeAnnotation.typeAnnotation.type;
    } else {
      propertyType = node.value ? node.value.type : node.value;
    }
  } else {
    if (node.computed) {
      const keyBeforeToken = sourceCode.getTokenBefore(node.key);
      const keyAfterToken = sourceCode.getTokenAfter(node.key);
      name = sourceCode
        .getText()
        .slice(keyBeforeToken.range[0], keyAfterToken.range[1]);
    } else {
      name = isPrivate
        ? `#${node.key.id ? node.key.id.name : node.key.name}`
        : node.key.name;
    }
    type = "method";
    async = !!(node.value && node.value.async);
  }

  return {
    name,
    type,
    decorators,
    static: !!node.static,
    abstract,
    override: !!node.override,
    readonly: !!node.readonly,
    async,
    private: isPrivate,
    accessibility: node.accessibility ?? "public",
    kind: node.kind,
    propertyType,
    node,
  };
}

/**
 * Finds getter/setter pairs that are separated or in the wrong order.
 *
 * @param {MemberInfo[]} members
 * @param {string} positioning The `accessorPairPositioning` option.
 * @returns {Problem[]}
 */
export function findAccessorPairProblems(members, positioning) {
  const problems = [];
  if (positioning === "any") {
    return problems;
  }

  forEachPair(members, (first, second, firstIndex, secondIndex) => {
    if (first.matchingAccessor !== second.id) {
      return;
    }

    const outOfOrder =
      (positioning === "getThenSet" && first.kind !== "get") ||
      (positioning === "setThenGet" && first.kind !== "set");
    const outOfPosition = secondIndex - firstIndex !== 1;

    if (outOfOrder || outOfPosition) {
      problems.push({
        source: second,
        target: first,
        expected: outOfOrder ? "before" : "after",
      });
    }
  });

  return problems;
}

/**
 * Finds every pair of members whose relative order violates the configured
 * slots.
 *
 * @param {MemberInfo[]} members Members with at least one acceptable slot.
 * @param {Intl.Collator} collator Used for alphabetical slots.
 * @returns {Problem[]}
 */
export function findProblems(members, collator) {
  const problems = [];

  forEachPair(members, (first, second) => {
    if (!areMembersInCorrectOrder(first, second, collator)) {
      problems.push({ source: second, target: first, expected: "before" });
    }
  });

  return problems;
}

/**
 * Human-readable description used in messages, e.g. `static getter foo`.
 *
 * @param {MemberInfo} member
 * @param {boolean} groupAccessors Whether accessor pairs are described as one.
 * @returns {string}
 */
export function getMemberDescription(member, groupAccessors) {
  if (member.kind === "constructor") {
    return "constructor";
  }

  let typeName;
  if (member.matchingAccessor && groupAccessors) {
    typeName = "accessor pair";
  } else if (isAccessor(member)) {
    typeName = `${member.kind}ter`;
  } else {
    typeName = member.type;
  }

  return `${member.static ? "static " : ""}${typeName} ${member.name}`;
}

/**
 * Whether a member is a getter or setter.
 *
 * @param {MemberInfo} member
 * @returns {boolean}
 */
export function isAccessor(member) {
  return member.kind === "get" || member.kind === "set";
}

function forEachPair(list, callback) {
  list.forEach((first, firstIndex) => {
    list.slice(firstIndex + 1).forEach((second, offset) => {
      callback(first, second, firstIndex, firstIndex + offset + 1);
    });
  });
}

function areMembersInCorrectOrder(first, second, collator) {
  return first.acceptableSlots.some((a) =>
    second.acceptableSlots.some((b) =>
      a.index === b.index && areSlotsAlphabeticallySorted(a, b)
        ? collator.compare(first.name, second.name) <= 0
        : a.index <= b.index
    )
  );
}

function areSlotsAlphabeticallySorted(a, b) {
  return a.sort === "alphabetical" && b.sort === "alphabetical";
}

function getAcceptableSlots(member, orderedSlots) {
  return orderedSlots
    .map((slot, index) => ({
      index,
      score: scoreMember(member, slot),
      sort: slot.sort,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .filter(({ score }, i, array) => score === array[0].score)
    .sort((a, b) => b.index - a.index);
}

function scoreMember(member, slot) {
  if (!Object.keys(slot).length) {
    // The default/everything-else slot.
    return 1;
  }

  const scores = comparers.map(({ property, value, test }) =>
    slot[property] === undefined ? 0 : test(member, slot) ? value : -1
  );

  if (scores.includes(-1)) {
    return -1;
  }

  return scores.reduce((a, b) => a + b, 0);
}

function matchAccessorPairs(members) {
  forEachPair(members, (first, second) => {
    const isMatch =
      first.name === second.name && first.static === second.static;
    if (isAccessor(first) && isAccessor(second) && isMatch) {
      first.isFirstAccessor = true;
      first.matchingAccessor = second.id;
      second.matchingAccessor = first.id;
    }
  });
}

function getStringComparer(str) {
  if (str[0] === "/") {
    let pattern = str.slice(1, -1);
    if (pattern[0] !== "^") {
      pattern = `^${pattern}`;
    }
    if (pattern[pattern.length - 1] !== "$") {
      pattern += "$";
    }
    const re = new RegExp(pattern);
    return (s) => re.test(s);
  }

  return (s) => s === str;
}
