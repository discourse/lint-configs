export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require `{{lazyHash}}` instead of `{{hash}}` for `@outletArgs` on `<PluginOutlet>`.",
    },
    schema: [],
    messages: {
      useLazyHash:
        "Use {{lazyHash}} instead of {{hash}} for @outletArgs in <PluginOutlet>.",
    },
  },

  create(context) {
    return {
      GlimmerElementNode(node) {
        if (node.tag !== "PluginOutlet" || !node.attributes) {
          return;
        }
        const outletArgsAttr = node.attributes.find(
          (attr) => attr.name === "@outletArgs"
        );
        if (!outletArgsAttr || !outletArgsAttr.value) {
          return;
        }
        const value = outletArgsAttr.value;
        if (
          value.type === "GlimmerMustacheStatement" &&
          value.path?.type === "GlimmerPathExpression" &&
          value.path.head?.type === "VarHead" &&
          value.path.head.name === "hash" &&
          !value.path.tail?.length
        ) {
          context.report({
            node: value,
            messageId: "useLazyHash",
          });
        }
      },
    };
  },
};
