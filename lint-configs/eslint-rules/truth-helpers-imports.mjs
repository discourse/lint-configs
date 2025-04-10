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
        if (/truth-helpers\/helpers\//i.test(node.source.value)) {
          context.report({
            node,
            message: `It is recommended to use 'truth-helpers' import instead of '${node.source.value}'.`,
            fix(fixer) {
              return fixer.replaceText(
                node,
                `import { ${node.specifiers[0].local.name} } from 'truth-helpers';`
              );
            },
          });
        }
      },
    };
  },
};
