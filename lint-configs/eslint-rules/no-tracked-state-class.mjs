import { isTestModule } from "./utils/test-files.mjs";
import {
  getTrackedImportNames,
  hasTrackedDecorator,
} from "./utils/tracked.mjs";

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
        "Use standalone `tracked()` values instead of a class that only holds `@tracked` fields: `const title = tracked(…)`, then read and assign `title.value`.",
    },
  },

  create(context) {
    if (!isTestModule(context.filename)) {
      return {};
    }

    let trackedNames;

    function checkClass(node) {
      const members = node.body.body;
      const onlyTrackedFields =
        members.length > 0 &&
        members.every(
          (member) =>
            member.type === "PropertyDefinition" &&
            hasTrackedDecorator(member, trackedNames)
        );

      if (!node.superClass && onlyTrackedFields) {
        context.report({
          node: node.id ?? node,
          messageId: "useTrackedValues",
        });
      }
    }

    return {
      Program() {
        trackedNames = getTrackedImportNames(context.sourceCode);
      },

      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
    };
  },
};
