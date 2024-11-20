import { generateRuleTests } from "ember-template-lint";
import plugin from "../../lint-configs/template-lint-rules/index.mjs";

generateRuleTests({
  name: "discourse/no-implicit-this",

  groupMethodBefore: beforeEach,
  groupingMethod: describe,
  testMethod: it,
  plugins: [plugin],

  config: true,

  good: ["{{this.foo}}"],

  bad: [
    {
      template: "{{foo}}",
      fixedTemplate: "{{this.foo}}",
      result: {
        column: 2,
        line: 1,
        source: "foo",
        message:
          "Ambiguous path 'foo' is not allowed. Use '@foo' if it is a named argument or 'this.foo' if it is a property on 'this'. If it is a helper or component that has no arguments, you must either convert it to an angle bracket invocation or manually add it to the 'no-implicit-this' rule configuration, e.g. 'no-implicit-this': { allow: ['foo'] }.",
        isFixable: true,
      },
    },
  ],
});
