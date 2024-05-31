module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "disallow imports from 'i18n' and replace with 'discourse-i18n'",
      category: "Best Practices",
      recommended: false,
    },
    fixable: "code",
    schema: [], // no options
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value === "i18n") {
          context.report({
            node,
            message: "Import from 'i18n' is not allowed. Use 'discourse-i18n' instead.",
            fix(fixer) {
              return fixer.replaceText(node.source, "'discourse-i18n'");
            },
          });
        }
      },
    };
  },
};