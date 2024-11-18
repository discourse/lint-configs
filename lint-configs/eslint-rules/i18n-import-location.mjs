import { fixImport } from "./utils/fix-import.mjs";

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "disallow imports from 'i18n' and replace with 'discourse-i18n'",
      category: "Best Practices",
      recommended: false,
    },
    fixable: "code",
    schema: [], // no options
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value.toLowerCase() === "i18n") {
          context.report({
            node,
            message:
              "Import from 'i18n' is not allowed. Use 'discourse-i18n' instead.",
            fix(fixer) {
              return fixer.replaceText(node.source, "'discourse-i18n'");
            },
          });
        }

        if (
          node.source.value.toLowerCase() === "discourse-common/helpers/i18n"
        ) {
          context.report({
            node,
            message:
              "Import from 'discourse-common/helpers/i18n' is not allowed. Use 'discourse-i18n' instead.",
            fix(fixer) {
              const existingImport = context
                .getSourceCode()
                .ast.body.find(
                  (n) =>
                    n.type === "ImportDeclaration" &&
                    n.source.value === "discourse-i18n"
                );

              if (existingImport) {
                return [
                  fixer.remove(node),
                  fixImport(fixer, existingImport, {
                    namedImportsToAdd: ["i18n"],
                  }),
                ];
              } else {
                return fixer.replaceText(
                  node,
                  `import { i18n } from 'discourse-i18n';`
                );
              }
            },
          });
        }
      },
    };
  },
};
