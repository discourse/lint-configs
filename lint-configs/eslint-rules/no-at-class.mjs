const AFFECTED_COMPONENTS = new Set([
  "DButton",
  "DModal",
  "TableHeaderToggle",
  "Textarea",
  "TextArea",
]);

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow `@class` on Discourse components that own their root element.",
    },
    fixable: "code",
    schema: [],
    messages: {
      noAtClass: "Use `class` instead of `@class` for {{tag}}.",
    },
  },

  create(context) {
    return {
      GlimmerElementNode(node) {
        if (!AFFECTED_COMPONENTS.has(node.tag) || !node.attributes) {
          return;
        }
        for (const attribute of node.attributes) {
          if (attribute.name !== "@class") {
            continue;
          }
          context.report({
            node: attribute,
            messageId: "noAtClass",
            data: { tag: node.tag },
            fix(fixer) {
              const [start] = attribute.range;
              return fixer.replaceTextRange([start, start + 1], "");
            },
          });
        }
      },
    };
  },
};
