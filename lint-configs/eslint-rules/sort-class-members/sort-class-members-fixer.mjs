/**
 * @fileoverview Fixer for the `sort-class-members` rule.
 *
 * Rewrites the whole class body in one fix instead of moving members pairwise.
 * Every member travels as a chunk: the comments above it (from the end of the
 * previous member's line), its decorators, the member itself, and a comment
 * on its closing line. Members without a key (`static {}` blocks, index
 * signatures, class-body `<template>` tags) and members that match no slot
 * keep their positions; the sortable members fill the remaining positions in
 * order. The whitespace between chunks stays where it was, so blank-line
 * structure is preserved and `lines-between-class-members` can normalise it
 * in the same pass.
 */

/**
 * @typedef {import("./sort-class-members-analysis.mjs").MemberInfo} MemberInfo
 */

/**
 * @typedef {object} Chunk
 * @property {import("estree").Node} node The class member node.
 * @property {number} start Range start, including leading comments.
 * @property {number} end Range end, including a same-line trailing comment.
 */

/**
 * Creates the ESLint `fix` function for one class body.
 *
 * @param {object} params
 * @param {import("eslint").SourceCode} params.sourceCode
 * @param {import("estree").Node} params.classBody The `ClassBody` (or
 *   `TSInterfaceBody`) node.
 * @param {MemberInfo[]} params.members Every keyed member, in source order.
 * @param {string} params.positioning The `accessorPairPositioning` option.
 * @param {Intl.Collator} params.collator Collator for alphabetical slots.
 * @returns {(fixer: import("eslint").Rule.RuleFixer) => import("eslint").Rule.Fix | null}
 */
export function createClassBodyFix({
  sourceCode,
  classBody,
  members,
  positioning,
  collator,
}) {
  return (fixer) => {
    const chunks = buildChunks(sourceCode, classBody);
    if (!chunks) {
      return null;
    }

    const order = sortedBody(classBody.body, members, positioning, collator);
    if (order.every((node, i) => node === classBody.body[i])) {
      return null;
    }

    const text = sourceCode.getText();
    const chunkByNode = new Map(chunks.map((chunk) => [chunk.node, chunk]));
    const pieces = order.map((node, i) => {
      const chunk = chunkByNode.get(node);
      const gap =
        i < chunks.length - 1
          ? text.slice(chunks[i].end, chunks[i + 1].start)
          : "";
      return text.slice(chunk.start, chunk.end) + gap;
    });

    return fixer.replaceTextRange(
      [chunks[0].start, chunks[chunks.length - 1].end],
      pieces.join("")
    );
  };
}

/**
 * Splits the class body into one chunk per member. Returns `null` when the
 * text between two chunks is not pure whitespace, which means a comment could
 * not be attributed to a member and moving anything would be unsafe.
 *
 * @param {import("eslint").SourceCode} sourceCode
 * @param {import("estree").Node} classBody
 * @returns {Chunk[] | null}
 */
function buildChunks(sourceCode, classBody) {
  const body = classBody.body;
  if (body.length === 0) {
    return null;
  }

  const comments = sourceCode
    .getAllComments()
    .filter(
      (comment) =>
        comment.range[0] > classBody.range[0] &&
        comment.range[1] < classBody.range[1]
    );
  const openingLine = classBody.loc.start.line;
  const chunks = [];
  // Position after the opening brace; advanced past each chunk.
  let cursor = classBody.range[0] + 1;

  body.forEach((node, i) => {
    const leading = comments.filter(
      (comment) =>
        comment.range[0] >= cursor &&
        comment.range[1] <= node.range[0] &&
        // A comment on the opening brace line belongs to the class, not to the
        // first member.
        (i > 0 || comment.loc.start.line !== openingLine)
    );
    const nextStart =
      i + 1 < body.length ? body[i + 1].range[0] : classBody.range[1] - 1;
    const trailing = comments.filter(
      (comment) =>
        comment.range[0] >= node.range[1] &&
        comment.range[1] <= nextStart &&
        comment.loc.start.line === node.loc.end.line
    );

    const start = leading.length ? leading[0].range[0] : node.range[0];
    const end = trailing.length
      ? trailing[trailing.length - 1].range[1]
      : node.range[1];
    chunks.push({ node, start, end });
    cursor = end;
  });

  const text = sourceCode.getText();
  for (let i = 0; i < chunks.length - 1; i++) {
    if (/\S/.test(text.slice(chunks[i].end, chunks[i + 1].start))) {
      return null;
    }
  }

  return chunks;
}

/**
 * Computes the desired order of the class body nodes.
 *
 * @param {import("estree").Node[]} body Nodes in source order.
 * @param {MemberInfo[]} members Keyed members with their acceptable slots.
 * @param {string} positioning The `accessorPairPositioning` option.
 * @param {Intl.Collator} collator
 * @returns {import("estree").Node[]} Nodes in the desired order.
 */
function sortedBody(body, members, positioning, collator) {
  const infoByNode = new Map(members.map((member) => [member.node, member]));
  const byId = new Map(members.map((member) => [member.id, member]));
  const isSortable = (member) => member && member.acceptableSlots.length > 0;

  const units = [];
  const seen = new Set();
  for (const member of members) {
    if (seen.has(member.id) || !isSortable(member)) {
      continue;
    }
    seen.add(member.id);

    let nodes = [member.node];
    const partner =
      positioning !== "any" && member.matchingAccessor
        ? byId.get(member.matchingAccessor)
        : null;
    if (partner && !seen.has(partner.id) && isSortable(partner)) {
      seen.add(partner.id);
      nodes = orderAccessorPair(member, partner, positioning).map(
        (accessor) => accessor.node
      );
    }

    units.push({ representative: member, nodes });
  }

  // Sorting by the highest acceptable slot index satisfies every pairwise
  // constraint the analysis checks, and Array#sort is stable, so members that
  // already sit in the right slot keep their relative order.
  units.sort((a, b) =>
    compareMembers(a.representative, b.representative, collator)
  );

  const sortedNodes = units.flatMap((unit) => unit.nodes);
  let next = 0;
  return body.map((node) =>
    isSortable(infoByNode.get(node)) ? sortedNodes[next++] : node
  );
}

function orderAccessorPair(first, second, positioning) {
  if (positioning === "getThenSet") {
    return first.kind === "get" ? [first, second] : [second, first];
  }
  if (positioning === "setThenGet") {
    return first.kind === "set" ? [first, second] : [second, first];
  }
  return Number(first.id) < Number(second.id)
    ? [first, second]
    : [second, first];
}

function compareMembers(a, b, collator) {
  const slotA = a.acceptableSlots[0];
  const slotB = b.acceptableSlots[0];
  if (slotA.index !== slotB.index) {
    return slotA.index - slotB.index;
  }
  if (slotA.sort === "alphabetical" && slotB.sort === "alphabetical") {
    return collator.compare(a.name, b.name);
  }
  return 0;
}
