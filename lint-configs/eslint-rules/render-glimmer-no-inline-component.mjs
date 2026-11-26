import { isTestModule } from "./utils/test-files.mjs";

const MODULE_LEVEL_SCOPES = new Set(["module", "global"]);

/**
 * Whether evaluating the node creates a new component.
 *
 * @param {import("estree").Node | null | undefined} node
 * @returns {boolean}
 */
function createsComponent(node) {
  return (
    node?.type === "GlimmerTemplate" ||
    node?.type === "ClassExpression" ||
    node?.type === "ClassDeclaration"
  );
}

/**
 * Whether the call is `renderGlimmer(...)` or `<object>.renderGlimmer(...)`.
 *
 * @param {import("estree").CallExpression} node
 * @returns {boolean}
 */
function isRenderGlimmerCall(node) {
  const callee =
    node.callee.type === "MemberExpression"
      ? node.callee.property
      : node.callee;

  return callee.type === "Identifier" && callee.name === "renderGlimmer";
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "disallow passing a component created inside a function to `renderGlimmer`",
    },
    schema: [], // no options
    messages: {
      useModuleLevelComponent:
        "Use a module-level component instead of one created on every `renderGlimmer` call: the rendering engine never releases a component it has rendered, nor anything its closure captures. Pass per-call values through the `data` argument and read them as `@data`.",
    },
  },

  create(context) {
    if (isTestModule(context.filename)) {
      return {};
    }

    const { sourceCode } = context;

    /**
     * Finds the node that creates the component held by a local variable, if
     * the variable is declared inside a function.
     */
    function findLocalComponentDefinition(identifier) {
      const variable = sourceCode
        .getScope(identifier)
        .references.find((ref) => ref.identifier === identifier)?.resolved;

      if (!variable || MODULE_LEVEL_SCOPES.has(variable.scope.type)) {
        return null;
      }

      // A reassigned variable could hold anything, so only single definitions
      // are followed.
      if (variable.defs.length !== 1) {
        return null;
      }

      const definition = variable.defs[0].node;
      const created =
        definition.type === "VariableDeclarator" ? definition.init : definition;

      return createsComponent(created) ? created : null;
    }

    return {
      CallExpression(node) {
        if (!isRenderGlimmerCall(node)) {
          return;
        }

        const component = node.arguments[1];
        if (!component) {
          return;
        }

        const createdPerCall =
          createsComponent(component) ||
          (component.type === "Identifier" &&
            findLocalComponentDefinition(component));

        if (createdPerCall) {
          context.report({
            node: component,
            messageId: "useModuleLevelComponent",
          });
        }
      },
    };
  },
};
