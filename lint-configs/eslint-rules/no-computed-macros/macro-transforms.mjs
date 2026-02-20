/**
 * @fileoverview Transform registry for computed property macros.
 *
 * Maps each macro name to its source, whether it can be auto-fixed,
 * what additional imports the transformation requires, how to generate
 * the getter body, and how to derive the dependent keys for @computed.
 */

import { propertyPathToOptionalChaining } from "../utils/property-path.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a property-path string to a `this.`-prefixed accessor.
 * Delegates to the shared utility from `utils/property-path.mjs`.
 *
 * @param {string} path
 * @returns {string}
 */
function toAccess(path) {
  return propertyPathToOptionalChaining(path, true, false);
}

/**
 * Render a JS literal value suitable for source output.
 * Strings → quoted, numbers/booleans → as-is, null → "null".
 *
 * @param {*} value
 * @returns {string}
 */
function renderLiteral(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Parse an Ember-style format string (using `%@` / `%@N` placeholders)
 * and return a JS template-literal expression.
 *
 * @param {string} format  - the format string, e.g. "/admin/users/%@1/%@2"
 * @param {string[]} propPaths - the property-path arguments preceding the format string
 * @returns {string} a template literal expression (with backticks)
 */
function fmtToTemplateLiteral(format, propPaths) {
  let seqIdx = 0;
  const result = format.replace(/%@(\d+)?/g, (_match, indexStr) => {
    const idx = indexStr ? parseInt(indexStr, 10) - 1 : seqIdx++;
    const path = propPaths[idx];
    if (!path) {
      return "";
    }
    return `\${${toAccess(path)}}`;
  });
  return `\`${result}\``;
}

/**
 * Check whether a dependent-key string is "local" (no dots, no special
 * tokens like `@each` or `[]`).
 *
 * @param {string} key
 * @returns {boolean}
 */
export function isLocalKey(key) {
  return !key.includes(".");
}

// ---------------------------------------------------------------------------
// Individual transforms
// ---------------------------------------------------------------------------

/** @typedef {{ name: string, source: string, isDefault?: boolean }} RequiredImport */

/**
 * @typedef {Object} MacroTransform
 * @property {string} source - import source where the macro lives
 * @property {boolean} canAutoFix
 * @property {string} [reason] - explanation when canAutoFix is false
 * @property {number} [depKeyArgCount] - how many leading args must be string
 *   literals (dep key paths); remaining args are "value args" that can be
 *   non-literal (their source text is used verbatim in the getter body)
 * @property {RequiredImport[]} [requiredImports]
 * @property {(args: TransformArgs) => string} [toGetterBody]
 * @property {(args: TransformArgs) => string[]} [toDependentKeys]
 */

/**
 * @typedef {Object} TransformArgs
 * @property {string[]} literalArgs - the literal string/number values of the decorator arguments
 * @property {import('estree').Node[]} argNodes - raw AST argument nodes
 * @property {string} propName - the decorated property name
 * @property {import('eslint').SourceCode} sourceCode
 */

const EMBER_SOURCE = "@ember/object/computed";
const DISCOURSE_SOURCE = "discourse/lib/computed";

// ---- @ember/object/computed ------------------------------------------------

const simpleAccess = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [path] }) {
    return `return ${toAccess(path)};`;
  },
  toDependentKeys({ literalArgs: [path] }) {
    return [path];
  },
};

const alias = { ...simpleAccess };
const readOnly = { ...simpleAccess };
const reads = { ...simpleAccess };
const oneWay = { ...simpleAccess };

const not = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [path] }) {
    return `return !${toAccess(path)};`;
  },
  toDependentKeys({ literalArgs: [path] }) {
    return [path];
  },
};

const bool = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [path] }) {
    return `return !!${toAccess(path)};`;
  },
  toDependentKeys({ literalArgs: [path] }) {
    return [path];
  },
};

const and = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs }) {
    return `return ${literalArgs.map(toAccess).join(" && ")};`;
  },
  toDependentKeys({ literalArgs }) {
    return [...literalArgs];
  },
};

const or = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs }) {
    return `return ${literalArgs.map(toAccess).join(" || ")};`;
  },
  toDependentKeys({ literalArgs }) {
    return [...literalArgs];
  },
};

function comparisonMacro(operator) {
  return {
    source: EMBER_SOURCE,
    canAutoFix: true,
    depKeyArgCount: 1,
    toGetterBody({ literalArgs: [path], argNodes, sourceCode }) {
      const valueText = sourceCode.getText(argNodes[1]);
      return `return ${toAccess(path)} ${operator} ${valueText};`;
    },
    toDependentKeys({ literalArgs: [path] }) {
      return [path];
    },
  };
}

const equal = comparisonMacro("===");
const gt = comparisonMacro(">");
const gte = comparisonMacro(">=");
const lt = comparisonMacro("<");
const lte = comparisonMacro("<=");

const notEmpty = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  requiredImports: [{ name: "isEmpty", source: "@ember/utils" }],
  toGetterBody({ literalArgs: [path] }) {
    return `return !isEmpty(${toAccess(path)});`;
  },
  toDependentKeys({ literalArgs: [path] }) {
    return [`${path}.length`];
  },
};

const empty = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  requiredImports: [{ name: "isEmpty", source: "@ember/utils" }],
  toGetterBody({ literalArgs: [path] }) {
    return `return isEmpty(${toAccess(path)});`;
  },
  toDependentKeys({ literalArgs: [path] }) {
    return [`${path}.length`];
  },
};

const none = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [path] }) {
    return `return ${toAccess(path)} == null;`;
  },
  toDependentKeys({ literalArgs: [path] }) {
    return [path];
  },
};

const match = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [path], argNodes, sourceCode }) {
    const regexText = sourceCode.getText(argNodes[1]);
    return `return ${regexText}.test(${toAccess(path)});`;
  },
  toDependentKeys({ literalArgs: [path] }) {
    return [path];
  },
};

const mapBy = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [arrPath, prop] }) {
    return `return ${toAccess(arrPath)}?.map((item) => item.${prop}) ?? [];`;
  },
  toDependentKeys({ literalArgs: [arrPath, prop] }) {
    return [`${arrPath}.@each.${prop}`];
  },
};

const filterBy = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs, argNodes }) {
    const arrPath = literalArgs[0];
    const prop = literalArgs[1];
    if (argNodes.length === 3) {
      const valueText =
        argNodes[2].raw !== undefined
          ? argNodes[2].raw
          : renderLiteral(argNodes[2].value);
      return `return ${toAccess(arrPath)}?.filter((item) => item.${prop} === ${valueText}) ?? [];`;
    }
    return `return ${toAccess(arrPath)}?.filter((item) => item.${prop}) ?? [];`;
  },
  toDependentKeys({ literalArgs: [arrPath, prop] }) {
    return [`${arrPath}.@each.${prop}`];
  },
};

const collect = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs }) {
    const items = literalArgs
      .map((p) => {
        const access = toAccess(p);
        return `${access} === undefined ? null : ${access}`;
      })
      .join(", ");
    return `return [${items}];`;
  },
  toDependentKeys({ literalArgs }) {
    return [...literalArgs];
  },
};

const sum = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [path] }) {
    return `return ${toAccess(path)}?.reduce((s, v) => s + v, 0) ?? 0;`;
  },
  toDependentKeys({ literalArgs: [path] }) {
    return [`${path}.[]`];
  },
};

const max = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [path] }) {
    return `return ${toAccess(path)}?.reduce((m, v) => Math.max(m, v), -Infinity) ?? -Infinity;`;
  },
  toDependentKeys({ literalArgs: [path] }) {
    return [`${path}.[]`];
  },
};

const min = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [path] }) {
    return `return ${toAccess(path)}?.reduce((m, v) => Math.min(m, v), Infinity) ?? Infinity;`;
  },
  toDependentKeys({ literalArgs: [path] }) {
    return [`${path}.[]`];
  },
};

const uniq = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  requiredImports: [
    { name: "uniqueItemsFromArray", source: "discourse/lib/array-tools" },
  ],
  toGetterBody({ literalArgs }) {
    if (literalArgs.length === 1) {
      return `return uniqueItemsFromArray(${toAccess(literalArgs[0])} ?? []);`;
    }
    const spreads = literalArgs
      .map((p) => `...(${toAccess(p)} ?? [])`)
      .join(", ");
    return `return uniqueItemsFromArray([${spreads}]);`;
  },
  toDependentKeys({ literalArgs }) {
    return literalArgs.map((p) => `${p}.[]`);
  },
};

const uniqBy = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  requiredImports: [
    { name: "uniqueItemsFromArray", source: "discourse/lib/array-tools" },
  ],
  toGetterBody({ literalArgs: [arrPath, key] }) {
    return `return uniqueItemsFromArray(${toAccess(arrPath)} ?? [], ${renderLiteral(key)});`;
  },
  toDependentKeys({ literalArgs: [arrPath] }) {
    return [`${arrPath}.[]`];
  },
};

// union === uniq (same function in Ember)
const union = { ...uniq };

const intersect = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs }) {
    // Ember filters from the LAST array against all others
    const last = literalArgs[literalArgs.length - 1];
    const rest = literalArgs.slice(0, -1);
    const conditions = rest
      .map((p) => `(${toAccess(p)} ?? []).includes(item)`)
      .join(" && ");
    return `return (${toAccess(last)} ?? []).filter((item) => ${conditions});`;
  },
  toDependentKeys({ literalArgs }) {
    return literalArgs.map((p) => `${p}.[]`);
  },
};

const setDiff = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [a, b] }) {
    return `return (${toAccess(a)} ?? []).filter((item) => !(${toAccess(b)} ?? []).includes(item));`;
  },
  toDependentKeys({ literalArgs: [a, b] }) {
    return [`${a}.[]`, `${b}.[]`];
  },
};

const sort = {
  source: EMBER_SOURCE,
  canAutoFix: true,
  requiredImports: [{ name: "compare", source: "@ember/utils" }],
  toGetterBody({ literalArgs: [arrPath, sortDefPath] }) {
    return [
      `return [...(${toAccess(arrPath)} ?? [])].sort((a, b) => {`,
      `  for (const s of ${toAccess(sortDefPath)} ?? []) {`,
      `    const [prop, dir = "asc"] = s.split(":");`,
      `    const result = compare(a[prop], b[prop]);`,
      `    if (result !== 0) {`,
      `      return dir === "desc" ? -result : result;`,
      `    }`,
      `  }`,
      `  return 0;`,
      `});`,
    ].join("\n");
  },
  toDependentKeys({ literalArgs: [arrPath, sortDefPath] }) {
    return [`${arrPath}.[]`, `${sortDefPath}.[]`];
  },
};

// filter/map with callback — not auto-fixable
const filter = {
  source: EMBER_SOURCE,
  canAutoFix: false,
  reason: "callback-based macro requires manual conversion",
};

const map = {
  source: EMBER_SOURCE,
  canAutoFix: false,
  reason: "callback-based macro requires manual conversion",
};

// ---- discourse/lib/computed ------------------------------------------------

const propertyEqual = {
  source: DISCOURSE_SOURCE,
  canAutoFix: true,
  requiredImports: [{ name: "deepEqual", source: "discourse/lib/object" }],
  toGetterBody({ literalArgs: [a, b] }) {
    return `return deepEqual(${toAccess(a)}, ${toAccess(b)});`;
  },
  toDependentKeys({ literalArgs: [a, b] }) {
    return [a, b];
  },
};

const propertyNotEqual = {
  source: DISCOURSE_SOURCE,
  canAutoFix: true,
  requiredImports: [{ name: "deepEqual", source: "discourse/lib/object" }],
  toGetterBody({ literalArgs: [a, b] }) {
    return `return !deepEqual(${toAccess(a)}, ${toAccess(b)});`;
  },
  toDependentKeys({ literalArgs: [a, b] }) {
    return [a, b];
  },
};

const propertyGreaterThan = {
  source: DISCOURSE_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [a, b] }) {
    return `return ${toAccess(a)} > ${toAccess(b)};`;
  },
  toDependentKeys({ literalArgs: [a, b] }) {
    return [a, b];
  },
};

const propertyLessThan = {
  source: DISCOURSE_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [a, b] }) {
    return `return ${toAccess(a)} < ${toAccess(b)};`;
  },
  toDependentKeys({ literalArgs: [a, b] }) {
    return [a, b];
  },
};

const setting = {
  source: DISCOURSE_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs: [name] }) {
    return `return this.siteSettings.${name};`;
  },
  toDependentKeys({ literalArgs: [name] }) {
    return [`siteSettings.${name}`];
  },
};

const fmt = {
  source: DISCOURSE_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs }) {
    const format = literalArgs[literalArgs.length - 1];
    const propPaths = literalArgs.slice(0, -1);
    return `return ${fmtToTemplateLiteral(format, propPaths)};`;
  },
  toDependentKeys({ literalArgs }) {
    return literalArgs.slice(0, -1);
  },
};

const url = {
  source: DISCOURSE_SOURCE,
  canAutoFix: true,
  requiredImports: [
    { name: "getURL", source: "discourse/lib/get-url", isDefault: true },
  ],
  toGetterBody({ literalArgs }) {
    const format = literalArgs[literalArgs.length - 1];
    const propPaths = literalArgs.slice(0, -1);
    return `return getURL(${fmtToTemplateLiteral(format, propPaths)});`;
  },
  toDependentKeys({ literalArgs }) {
    return literalArgs.slice(0, -1);
  },
};

const i18n = {
  source: DISCOURSE_SOURCE,
  canAutoFix: true,
  requiredImports: [{ name: "i18n", source: "discourse-i18n" }],
  toGetterBody({ literalArgs }) {
    const format = literalArgs[literalArgs.length - 1];
    const propPaths = literalArgs.slice(0, -1);
    return `return i18n(${fmtToTemplateLiteral(format, propPaths)});`;
  },
  toDependentKeys({ literalArgs }) {
    return literalArgs.slice(0, -1);
  },
};

const htmlSafe = {
  source: DISCOURSE_SOURCE,
  canAutoFix: true,
  requiredImports: [{ name: "htmlSafe", source: "@ember/template" }],
  toGetterBody({ literalArgs: [path] }) {
    return `return htmlSafe(${toAccess(path)});`;
  },
  toDependentKeys({ literalArgs: [path] }) {
    return [path];
  },
};

const endWith = {
  source: DISCOURSE_SOURCE,
  canAutoFix: true,
  toGetterBody({ literalArgs }) {
    const suffix = literalArgs[literalArgs.length - 1];
    const propPaths = literalArgs.slice(0, -1);
    if (propPaths.length === 1) {
      return `return ${toAccess(propPaths[0])}?.endsWith(${renderLiteral(suffix)});`;
    }
    const checks = propPaths
      .map((p) => `${toAccess(p)}?.endsWith(${renderLiteral(suffix)})`)
      .join(" && ");
    return `return ${checks};`;
  },
  toDependentKeys({ literalArgs }) {
    return literalArgs.slice(0, -1);
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** @type {Map<string, MacroTransform>} */
export const MACRO_TRANSFORMS = new Map([
  // @ember/object/computed
  ["alias", alias],
  ["readOnly", readOnly],
  ["reads", reads],
  ["oneWay", oneWay],
  ["not", not],
  ["bool", bool],
  ["and", and],
  ["or", or],
  ["equal", equal],
  ["gt", gt],
  ["gte", gte],
  ["lt", lt],
  ["lte", lte],
  ["notEmpty", notEmpty],
  ["empty", empty],
  ["none", none],
  ["match", match],
  ["mapBy", mapBy],
  ["filterBy", filterBy],
  ["collect", collect],
  ["sum", sum],
  ["max", max],
  ["min", min],
  ["uniq", uniq],
  ["uniqBy", uniqBy],
  ["union", union],
  ["intersect", intersect],
  ["setDiff", setDiff],
  ["sort", sort],
  ["filter", filter],
  ["map", map],
  // discourse/lib/computed
  ["propertyEqual", propertyEqual],
  ["propertyNotEqual", propertyNotEqual],
  ["propertyGreaterThan", propertyGreaterThan],
  ["propertyLessThan", propertyLessThan],
  ["setting", setting],
  ["fmt", fmt],
  ["url", url],
  ["i18n", i18n],
  ["computedI18n", i18n], // alias — exported as both names
  ["htmlSafe", htmlSafe],
  ["endWith", endWith],
]);

/** The two import sources this rule targets. */
export const MACRO_SOURCES = new Set([
  "@ember/object/computed",
  "discourse/lib/computed",
]);
