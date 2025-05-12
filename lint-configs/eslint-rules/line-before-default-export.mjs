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
      ExportDefaultDeclaration(node) {
        const declaration = node.declaration;
        const decorators = declaration?.decorators || [];
        const targetNode = decorators.length > 0 ? decorators[0] : node;

        const previousToken = sourceCode.getTokenBefore(targetNode, {
          includeComments: true,
        });

        if (!previousToken) {
          return;
        }

        const isPadded =
          targetNode.loc.start.line - previousToken.loc.end.line > 1;

        if (isPadded) {
          return;
        }

        context.report({
          node: targetNode,
          message: "Expected blank line before the default export.",

          fix(fixer) {
            return fixer.insertTextAfter(previousToken, "\n");
          },
        });
      },
    };
  },
};
