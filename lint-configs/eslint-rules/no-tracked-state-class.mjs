import { isTestModule } from "./utils/test-files.mjs";
import {
  getTrackedImportNames,
  hasTrackedDecorator,
} from "./utils/tracked.mjs";

function isTrackedField(member, trackedNames) {
  return (
    member.type === "PropertyDefinition" &&
    !member.static &&
    !member.computed &&
    member.key.type === "Identifier" &&
    hasTrackedDecorator(member, trackedNames)
  );
}

function isThisFieldAssignment(statement, fieldNames) {
  const expression = statement.expression;
  return (
    statement.type === "ExpressionStatement" &&
    expression.type === "AssignmentExpression" &&
    expression.operator === "=" &&
    expression.left.type === "MemberExpression" &&
    expression.left.object.type === "ThisExpression" &&
    !expression.left.computed &&
    fieldNames.has(expression.left.property.name)
  );
}

// A constructor that does nothing but initialize the tracked fields.
function isInitializingConstructor(member, fieldNames) {
  return (
    member.type === "MethodDefinition" &&
    member.kind === "constructor" &&
    member.value.body.body.every((statement) =>
      isThisFieldAssignment(statement, fieldNames)
    )
  );
}

function trackedStateFields(classNode, trackedNames) {
  const members = classNode.body.body;
  const fields = members.filter((member) =>
    isTrackedField(member, trackedNames)
  );
  if (!fields.length) {
    return;
  }

  const fieldNames = new Set(fields.map((field) => field.key.name));
  const onlyState = members.every(
    (member) =>
      fields.includes(member) || isInitializingConstructor(member, fieldNames)
  );

  return onlyState ? fields : undefined;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Use standalone `tracked()` values in tests instead of classes that only hold `@tracked` fields",
    },
    schema: [], // no options
    messages: {
      useTrackedValues:
        "Use standalone `tracked()` values instead of a class that only holds `@tracked` fields: `const {{name}} = tracked(…)`, then read and assign `{{name}}.value`.",
    },
  },

  create(context) {
    if (!isTestModule(context.filename)) {
      return {};
    }

    let trackedNames;
    const extendedClassNames = new Set();
    const candidates = [];

    function checkClass(node) {
      if (node.superClass) {
        if (node.superClass.type === "Identifier") {
          extendedClassNames.add(node.superClass.name);
        }
        return;
      }

      const fields = trackedStateFields(node, trackedNames);
      if (fields) {
        candidates.push({ node, fields });
      }
    }

    return {
      Program() {
        trackedNames = getTrackedImportNames(context.sourceCode);
      },

      ClassDeclaration: checkClass,
      ClassExpression: checkClass,

      "Program:exit"() {
        for (const { node, fields } of candidates) {
          // A subclass makes this more than a bag of state.
          if (node.id && extendedClassNames.has(node.id.name)) {
            continue;
          }

          context.report({
            node: node.id ?? node,
            messageId: "useTrackedValues",
            data: { name: fields[0].key.name },
          });
        }
      },
    };
  },
};
