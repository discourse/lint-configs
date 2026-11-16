import { getNamedImportLocalNames } from "./utils/analyze-imports.mjs";
import { isTestModule } from "./utils/test-files.mjs";

const SET_METHODS = new Set(["set", "setProperties"]);

function isFunction(node) {
  return (
    node.type === "FunctionExpression" || node.type === "FunctionDeclaration"
  );
}

// The function whose `this` a node sees (arrow functions inherit it), and
// whether the node sits in an arrow function inside it.
function thisScope(node) {
  let inArrow = false;

  for (let current = node.parent; current; current = current.parent) {
    if (isFunction(current)) {
      return { scope: current, inArrow };
    }

    inArrow ||= current.type === "ArrowFunctionExpression";
  }

  return {};
}

function findVariable(scope, name) {
  for (let current = scope; current; current = current.upper) {
    const variable = current.set.get(name);
    if (variable) {
      return variable;
    }
  }
}

// `<template>` itself, or a local bound to one. Anything else (e.g. an `hbs`
// template on `this`) is classic rendering, where `this.set` is the norm.
function isTemplateTag(node, sourceCode) {
  if (node?.type === "GlimmerTemplate") {
    return true;
  }

  if (node?.type !== "Identifier") {
    return false;
  }

  const definition = findVariable(sourceCode.getScope(node), node.name)
    ?.defs[0];
  return (
    definition?.type === "Variable" &&
    definition.node.init?.type === "GlimmerTemplate"
  );
}

function thisSetMethod(node) {
  const callee = node.callee;
  if (
    callee.type === "MemberExpression" &&
    callee.object.type === "ThisExpression" &&
    !callee.computed &&
    SET_METHODS.has(callee.property.name)
  ) {
    return callee.property.name;
  }
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Use standalone `tracked()` values instead of `this.set` to change arguments of a rendered `<template>` in tests",
    },
    schema: [], // no options
    messages: {
      afterRender:
        "Use a standalone `tracked()` value instead of `this.{{method}}()` after render: pass its `.value` to the template, assign a new `.value`, then `await rerender()`.",
      inCallback:
        "Use a standalone `tracked()` value instead of `this.{{method}}()` in a callback: assign its `.value` (or a local variable, if the template doesn't read it).",
    },
  },

  create(context) {
    if (!isTestModule(context.filename)) {
      return {};
    }

    let renderNames;
    // Per function: where it first renders a `<template>`, and its `this.set`
    // calls. Callbacks run after render even when defined before it, so the
    // calls are only judged once the whole function has been seen.
    const functions = new Map();

    function functionInfo(scope) {
      if (!functions.has(scope)) {
        functions.set(scope, { renderStart: Infinity, calls: [] });
      }
      return functions.get(scope);
    }

    function isTemplateRender(node) {
      return (
        node.callee.type === "Identifier" &&
        renderNames.has(node.callee.name) &&
        isTemplateTag(node.arguments[0], context.sourceCode)
      );
    }

    function reportCalls(scope) {
      const { renderStart, calls } = functions.get(scope) ?? { calls: [] };
      functions.delete(scope);

      for (const { node, method, inArrow } of calls) {
        if (inArrow ? renderStart < Infinity : node.range[0] > renderStart) {
          context.report({
            node,
            messageId: inArrow ? "inCallback" : "afterRender",
            data: { method },
          });
        }
      }
    }

    return {
      Program() {
        renderNames = getNamedImportLocalNames(
          context.sourceCode,
          "@ember/test-helpers",
          "render"
        );
      },

      CallExpression(node) {
        const { scope, inArrow } = thisScope(node);
        if (!scope) {
          return;
        }

        const method = thisSetMethod(node);
        if (method) {
          functionInfo(scope).calls.push({ node, method, inArrow });
        } else if (isTemplateRender(node)) {
          const info = functionInfo(scope);
          info.renderStart = Math.min(info.renderStart, node.range[0]);
        }
      },

      "FunctionExpression:exit": reportCalls,
      "FunctionDeclaration:exit": reportCalls,
    };
  },
};
