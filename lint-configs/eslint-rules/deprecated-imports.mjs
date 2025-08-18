export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Use the correct import paths",
    },
    fixable: "code",
    schema: [], // no options
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value === "discourse/helpers/get-url") {
          context.report({
            node,
            message:
              "Use 'discourse/lib/get-url' instead of 'discourse/helpers/get-url'",
            fix(fixer) {
              return fixer.replaceText(node.source, `"discourse/lib/get-url"`);
            },
          });
        } else if (
          node.source.value === "discourse/helpers/html-safe" &&
          node.specifiers[0]?.local.name === "htmlSafe"
        ) {
          context.report({
            node,
            message:
              "Use '@ember/template' instead of 'discourse/helpers/html-safe'",
            fix(fixer) {
              return fixer.replaceText(
                node,
                `import { htmlSafe } from "@ember/template";`
              );
            },
          });
        } else if (
          node.source.value === "@ember/application" &&
          node.specifiers[0]?.local.name === "getOwner"
        ) {
          context.report({
            node,
            message:
              "Use '@ember/owner' instead of '@ember/application' to import 'getOwner'",
            fix(fixer) {
              return fixer.replaceText(
                node,
                `import { getOwner } from "@ember/owner";`
              );
            },
          });
        }
      },
    };
  },
};
