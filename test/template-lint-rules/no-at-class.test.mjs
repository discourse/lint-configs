import { generateRuleTests } from "ember-template-lint";
import plugin from "../../lint-configs/template-lint-rules/index.mjs";

generateRuleTests({
  name: "discourse/no-at-class",

  groupMethodBefore: globalThis.beforeEach,
  groupingMethod: globalThis.describe,
  testMethod: globalThis.it,
  plugins: [plugin],

  config: true,

  good: ['<DButton class="foo" />', '<OtherComponent @class="foo" />'],

  bad: [
    {
      template: '<DButton @class="foo" />',
      fixedTemplate: '<DButton class="foo" />',
      result: {
        column: 0,
        line: 1,
        source: '<DButton @class="foo" />',
        message: "Use 'class' instead of '@class' for DButton.",
        isFixable: true,
      },
    },
  ],
});
