import { getTrackedImportNames } from "./utils/tracked.mjs";

// Mirrors ember-source's DECORATOR_OPTION_KEYS: `tracked()` called with a lone
// plain object made of only these keys returns a decorator instead of a
// `TrackedValue`.
const DECORATOR_OPTION_KEYS = new Set([
  "value",
  "initializer",
  "equals",
  "description",
]);

function isOptionsShaped(node) {
  return (
    node.type === "ObjectExpression" &&
    node.properties.every(
      (property) =>
        property.type === "Property" &&
        !property.computed &&
        DECORATOR_OPTION_KEYS.has(property.key.name ?? property.key.value)
    )
  );
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow standalone `tracked()` calls that return a decorator instead of a tracked value",
    },
    schema: [], // no options
    messages: {
      returnsDecorator:
        "Use `tracked(undefined)`, or pass options as a second argument (e.g. `tracked({}, {})`): without arguments, or with a lone object of only `value`, `initializer`, `equals` or `description` keys, `tracked()` returns a decorator, not a tracked value.",
    },
  },

  create(context) {
    let trackedNames;

    return {
      Program() {
        trackedNames = getTrackedImportNames(context.sourceCode);
      },

      CallExpression(node) {
        const { callee, parent } = node;
        if (
          callee.type !== "Identifier" ||
          !trackedNames.has(callee.name) ||
          // `@tracked(...)`, or a classic field: `EmberObject.extend({ name: tracked(...) })`
          parent.type === "Decorator" ||
          parent.type === "Property"
        ) {
          return;
        }

        const [argument, ...rest] = node.arguments;
        if (!argument || (!rest.length && isOptionsShaped(argument))) {
          context.report({ node, messageId: "returnsDecorator" });
        }
      },
    };
  },
};
