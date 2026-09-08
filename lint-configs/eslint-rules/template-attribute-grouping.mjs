/**
 * @fileoverview Enforce grouped and sorted parts on element and component
 * invocations in templates: plain attributes first, then `@arguments`, then
 * modifiers. Attributes and arguments are alphabetical; attributes never cross
 * `...attributes`, because their position relative to the splat decides
 * whether the caller's value or the component's own value wins. Modifiers keep
 * their source order, because they install in that order and some depend on
 * it.
 */

const collator = new Intl.Collator("en-US");

const ATTRIBUTE = 0;
const ARGUMENT = 1;
const MODIFIER = 2;

export default {
  meta: {
    type: "layout",
    docs: {
      description:
        "Group invocation parts as attributes, arguments, then modifiers, with attributes and arguments alphabetical",
    },
    fixable: "code",
    schema: [],
    messages: {
      order:
        "Order the parts as attributes, then `@arguments`, then modifiers. Sort attributes (on each side of `...attributes`) and arguments alphabetically; keep modifiers in source order.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;

    /**
     * Trims a node's range to its text, because some Glimmer nodes (the
     * `...attributes` splat among them) include trailing whitespace.
     */
    function trimmedRange(node) {
      const text = sourceCode.getText(node);
      return [node.range[0], node.range[0] + text.trimEnd().length];
    }

    return {
      GlimmerElementNode(node) {
        const parts = [...(node.attributes || []), ...(node.modifiers || [])]
          .filter(
            (part) =>
              part.type === "GlimmerAttrNode" ||
              part.type === "GlimmerElementModifierStatement"
          )
          .map((part) => ({
            node: part,
            kind: kindOf(part),
            name: part.name,
            range: trimmedRange(part),
          }))
          .sort((a, b) => a.range[0] - b.range[0]);

        if (parts.length < 2) {
          return;
        }

        const chunks = buildChunks(parts, node.comments || []);
        const desired = desiredOrder(chunks);
        if (desired.every((chunk, i) => chunk === chunks[i])) {
          return;
        }

        const first = chunks[0];
        const last = chunks[chunks.length - 1];
        context.report({
          loc: {
            start: sourceCode.getLocFromIndex(first.start),
            end: sourceCode.getLocFromIndex(last.end),
          },
          messageId: "order",
          fix(fixer) {
            const text = sourceCode.getText();
            for (let i = 0; i < chunks.length - 1; i++) {
              if (/\S/.test(text.slice(chunks[i].end, chunks[i + 1].start))) {
                return null;
              }
            }

            const pieces = desired.map((chunk, i) => {
              const gap =
                i < chunks.length - 1
                  ? text.slice(chunks[i].end, chunks[i + 1].start)
                  : "";
              return text.slice(chunk.start, chunk.end) + gap;
            });
            return fixer.replaceTextRange(
              [first.start, last.end],
              pieces.join("")
            );
          },
        });
      },
    };

    /**
     * Pairs every part with the tag comments that precede it, so a comment
     * explaining a part travels with it. Comments after the last part are left
     * where they are.
     */
    function buildChunks(parts, comments) {
      const sortedComments = comments
        .map((comment) => ({ range: trimmedRange(comment) }))
        .sort((a, b) => a.range[0] - b.range[0]);
      let cursor = 0;

      return parts.map((part) => {
        const leading = sortedComments.filter(
          (comment) =>
            comment.range[0] >= cursor && comment.range[1] <= part.range[0]
        );
        cursor = part.range[1];
        return {
          part,
          start: leading.length ? leading[0].range[0] : part.range[0],
          end: part.range[1],
        };
      });
    }
  },
};

function kindOf(part) {
  if (part.type === "GlimmerElementModifierStatement") {
    return MODIFIER;
  }
  return part.name.startsWith("@") ? ARGUMENT : ATTRIBUTE;
}

function desiredOrder(chunks) {
  const attributes = chunks.filter((chunk) => chunk.part.kind === ATTRIBUTE);
  const args = chunks.filter((chunk) => chunk.part.kind === ARGUMENT);
  const modifiers = chunks.filter((chunk) => chunk.part.kind === MODIFIER);

  const splatIndex = attributes.findIndex(
    (chunk) => chunk.part.name === "...attributes"
  );
  const sortedAttributes =
    splatIndex === -1
      ? byName(attributes)
      : [
          ...byName(attributes.slice(0, splatIndex)),
          attributes[splatIndex],
          ...byName(attributes.slice(splatIndex + 1)),
        ];

  return [...sortedAttributes, ...byName(args), ...modifiers];
}

function byName(chunks) {
  return [...chunks].sort((a, b) => collator.compare(a.part.name, b.part.name));
}
