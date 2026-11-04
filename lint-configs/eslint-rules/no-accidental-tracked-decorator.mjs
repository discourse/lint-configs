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

// Classic classes take decorators as field values:
// `EmberObject.extend({ name: tracked({ value: "Zoey" }) })`.
const CLASSIC_CLASS_METHODS = new Set(["extend", "reopen", "reopenClass"]);

function propertyKeyName(property) {
  if (property.computed) {
    return;
  }

  return property.key.type === "Identifier"
    ? property.key.name
    : property.key.value;
}

function isOptionsShaped(node) {
  return (
    node.type === "ObjectExpression" &&
    node.properties.every(
      (property) =>
        property.type === "Property" &&
        DECORATOR_OPTION_KEYS.has(propertyKeyName(property))
    )
  );
}

function isClassicClassField(node) {
  const property = node.parent;
  if (property.type !== "Property" || property.value !== node) {
    return false;
  }

  const object = property.parent;
  const call = object.parent;
  return (
    call?.type === "CallExpression" &&
    call.arguments.includes(object) &&
    call.callee.type === "MemberExpression" &&
    !call.callee.computed &&
    CLASSIC_CLASS_METHODS.has(call.callee.property.name)
  );
}

function isIntendedDecorator(node) {
  return node.parent.type === "Decorator" || isClassicClassField(node);
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow standalone `tracked()` calls that return a decorator instead of a tracked value",
    },
    hasSuggestions: true,
    schema: [], // no options
    messages: {
      noArguments:
        "Use `tracked(undefined)` instead of `tracked()`: without arguments it returns a decorator, not a tracked value.",
      optionsShapedArgument:
        "Pass options as a second argument, e.g. `tracked({}, {})`: a lone object with only `value`, `initializer`, `equals` or `description` keys returns a decorator, not a tracked value.",
      useUndefined: "Use `tracked(undefined)`.",
      addOptions: "Add an empty options argument.",
    },
  },

  create(context) {
    const { sourceCode } = context;
    let trackedNames;

    function isTrackedCall(node) {
      return (
        node.callee.type === "Identifier" && trackedNames.has(node.callee.name)
      );
    }

    return {
      Program() {
        trackedNames = getTrackedImportNames(sourceCode);
      },

      CallExpression(node) {
        if (!isTrackedCall(node) || isIntendedDecorator(node)) {
          return;
        }

        if (node.arguments.length === 0) {
          const closeParen = sourceCode.getLastToken(node);
          context.report({
            node,
            messageId: "noArguments",
            suggest: [
              {
                messageId: "useUndefined",
                fix: (fixer) => fixer.insertTextBefore(closeParen, "undefined"),
              },
            ],
          });
          return;
        }

        const [argument] = node.arguments;
        if (node.arguments.length === 1 && isOptionsShaped(argument)) {
          context.report({
            node,
            messageId: "optionsShapedArgument",
            suggest: [
              {
                messageId: "addOptions",
                fix: (fixer) => fixer.insertTextAfter(argument, ", {}"),
              },
            ],
          });
        }
      },
    };
  },
};
