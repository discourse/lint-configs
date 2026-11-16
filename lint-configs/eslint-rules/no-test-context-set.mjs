import { isTestModule } from "./utils/test-files.mjs";

const SET_METHODS = new Set(["set", "setProperties"]);
// Callbacks of these get the test context as `this`
const TEST_FUNCTIONS = new Set(["test", "skip", "only", "todo", "module"]);
const HOOKS = new Set(["beforeEach", "afterEach", "before", "after"]);
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function isTestContextFunction(node) {
  const call = node.parent;
  if (call?.type !== "CallExpression" || !call.arguments.includes(node)) {
    return false;
  }

  const { callee } = call;
  if (callee.type === "Identifier") {
    return TEST_FUNCTIONS.has(callee.name);
  }

  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    (HOOKS.has(callee.property.name) ||
      TEST_FUNCTIONS.has(callee.property.name))
  );
}

// The function whose `this` a node sees (arrow functions inherit it), and
// whether the node sits in an arrow function inside it.
function thisScope(node) {
  let inArrow = false;

  for (let current = node.parent; current; current = current.parent) {
    if (
      current.type === "FunctionExpression" ||
      current.type === "FunctionDeclaration"
    ) {
      return { scope: current, inArrow };
    }

    inArrow ||= current.type === "ArrowFunctionExpression";
  }

  return {};
}

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function nearestFunction(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (FUNCTION_TYPES.has(current.type)) {
      return current;
    }
  }
}

function propertyPath(key) {
  return IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}

function staticKey(node) {
  if (node?.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
}

// `this.set("a.b", value)` → `this.a.b = value`
function assignmentForSet(node, sourceCode) {
  const [key, value, ...rest] = node.arguments;
  const path = staticKey(key);
  if (!path || !value || rest.length || value.type === "SequenceExpression") {
    return;
  }

  const parts = path.split(".");
  if (parts.length > 1 && !parts.every((part) => IDENTIFIER.test(part))) {
    return;
  }

  return `this${parts.map(propertyPath).join("")} = ${sourceCode.getText(value)}`;
}

// `this.setProperties({ a, b: 1 })` → `this.a = a;` + `this.b = 1`, or
// `Object.assign(this, …)` when the object isn't a plain list of properties
function assignmentForSetProperties(node, sourceCode, indent) {
  const [object, ...rest] = node.arguments;
  if (!object || rest.length) {
    return;
  }

  const plain =
    object.type === "ObjectExpression" &&
    object.properties.length > 0 &&
    object.properties.every(
      (property) =>
        property.type === "Property" &&
        property.kind === "init" &&
        !property.method &&
        !property.computed
    );

  if (!plain) {
    return `Object.assign(this, ${sourceCode.getText(object)})`;
  }

  return object.properties
    .map((property) => {
      const name = property.key.name ?? property.key.value;
      return `this${propertyPath(name)} = ${sourceCode.getText(property.value)}`;
    })
    .join(`;\n${indent}`);
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Use native assignment or standalone `tracked()` values instead of `this.set` on the test context",
    },
    fixable: "code",
    schema: [], // no options
    messages: {
      useAssignment: "Use native assignment instead of `this.{{method}}()`.",
      useTracked:
        "Use a standalone `tracked()` value instead of `this.{{method}}()`: assign its `.value` (then `await rerender()` when the test writes it), or a local variable if no rendered template reads it.",
    },
  },

  create(context) {
    if (!isTestModule(context.filename)) {
      return {};
    }

    const { sourceCode } = context;
    // Test functions that have awaited something, e.g. `render()`. A template
    // may then read the context, and only `set` (or `tracked()`) updates it.
    const awaited = new WeakSet();

    return {
      AwaitExpression(node) {
        const fn = nearestFunction(node);
        if (fn) {
          awaited.add(fn);
        }
      },

      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== "MemberExpression" ||
          callee.object.type !== "ThisExpression" ||
          callee.computed ||
          !SET_METHODS.has(callee.property.name)
        ) {
          return;
        }

        const { scope, inArrow } = thisScope(node);
        if (!scope || !isTestContextFunction(scope)) {
          return;
        }

        const method = callee.property.name;
        const beforeRender = !inArrow && !awaited.has(scope);
        const statement = node.parent;
        const assignment =
          beforeRender &&
          statement.type === "ExpressionStatement" &&
          (method === "set"
            ? assignmentForSet(node, sourceCode)
            : assignmentForSetProperties(
                node,
                sourceCode,
                " ".repeat(statement.loc.start.column)
              ));

        context.report({
          node,
          messageId: beforeRender ? "useAssignment" : "useTracked",
          data: { method },
          fix: assignment
            ? (fixer) => fixer.replaceText(node, assignment)
            : undefined,
        });
      },
    };
  },
};
