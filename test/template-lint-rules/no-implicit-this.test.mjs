import { generateRuleTests } from "ember-template-lint";
import plugin from "../../lint-configs/template-lint-rules/index.mjs";

generateRuleTests({
  name: "discourse/no-implicit-this",

  groupMethodBefore: globalThis.beforeEach,
  groupingMethod: globalThis.describe,
  testMethod: globalThis.it,
  plugins: [plugin],

  config: true,

  good: [
    {
      template: "{{this.foo}}",
      meta: {
        moduleId: "hello.gjs",
      },
    },
    {
      template: "{{this.foo}}",
      meta: {
        moduleId: "hello.hbs",
      },
    },
  ],

  bad: [
    {
      template: "{{foo}}",
      fixedTemplate: "{{this.foo}}",
      meta: {
        moduleId: "hello.hbs",
      },
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
