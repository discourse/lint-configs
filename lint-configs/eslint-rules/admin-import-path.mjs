export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Use the updated import path for admin modules",
    },
    fixable: "code",
    schema: [], // no options
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value.startsWith("admin/")) {
          const correctedValue = `discourse/${node.source.value}`;
          context.report({
            node,
            message: `Use '${correctedValue}' instead of '${node.source.value}'`,
            fix(fixer) {
              return fixer.replaceText(node.source, `"${correctedValue}"`);
            },
          });
        }
      },
    };
  },
};
