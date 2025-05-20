export default {
  meta: {
    type: "problem",
    docs: {
      description: "disallow api.registerConnectorClass() uses",
    },
    fixable: "code",
    schema: [], // no options
  },

  create(context) {
    return {
      CallExpression(node) {
        const { callee, arguments: args } = node;

        if (
          callee.type === "MemberExpression" &&
          callee.property.name === "registerConnectorClass" &&
          args.length === 3
        ) {
          context.report({
            node,
            message:
              "registerConnectorClass is deprecated. Create a glimmer component in a plugin connector directory or use renderInOutlet instead.",
          });
        }
      },
    };
  },
};
