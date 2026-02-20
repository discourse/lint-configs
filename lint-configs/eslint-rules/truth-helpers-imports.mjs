import { buildImportStatement } from "./utils/fix-import.mjs";

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "use the shorter form of truth-helpers import",
    },
    fixable: "code",
    schema: [], // no options
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value.startsWith("truth-helpers/helpers/")) {
          context.report({
            node,
            message: `It is recommended to use 'truth-helpers' import instead of '${node.source.value}'.`,
            fix(fixer) {
              let code;
              const localName = node.specifiers[0].local.name;
              let sourceName = node.source.value.match(/([^/]+)$/)[0];

              if (sourceName === "not-eq") {
                sourceName = "notEq";
              }

              const namedImport =
                localName === sourceName
                  ? localName
                  : `${sourceName} as ${localName}`;
              code = buildImportStatement("truth-helpers", {
                namedImports: [namedImport],
                quote: "'",
              });

              return fixer.replaceText(node, code);
            },
          });
        }
      },
    };
  },
};
