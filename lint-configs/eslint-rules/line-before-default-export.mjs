export default {
  meta: {
    type: "layout",
    docs: {
      description: "Require an empty line before the default export",
    },
    fixable: "whitespace",
    schema: [], // no options
  },

  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Program(node) {
        const body = node.body;
        const index = body.findIndex(
          (n) => n.type === "ExportDefaultDeclaration"
        );

        if (index === -1 || index === 0) {
          // No default export or starts with the export
          return;
        }

        const currentToken = body[index];
        const previousToken = sourceCode.getTokenBefore(currentToken);

        const isPadded =
          currentToken.loc.end.line - previousToken.loc.end.line > 1;

        if (isPadded) {
          return;
        }

        context.report({
          node: body[index],
          message: "Expected blank line before the default export.",

          fix(fixer) {
            return fixer.insertTextAfter(previousToken, "\n");
          },
        });
      },
    };
  },
};
