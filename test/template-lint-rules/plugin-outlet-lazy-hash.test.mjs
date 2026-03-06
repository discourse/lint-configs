import { generateRuleTests } from "ember-template-lint";
import { beforeEach, describe, it } from "mocha";
import plugin from "../../lint-configs/template-lint-rules/index.mjs";

generateRuleTests({
  name: "discourse/plugin-outlet-lazy-hash",

  groupMethodBefore: beforeEach,
  groupingMethod: describe,
  testMethod: it,
  plugins: [plugin],

  config: true,

  good: [
    {
      template: `
        <PluginOutlet @outletArgs={{lazyHash foo="bar"}} />
      `,
      meta: {
        moduleId: "good-example.hbs",
      },
    },
    {
      template: `
        <PluginOutlet />
      `,
      meta: {
        moduleId: "good-example-2.hbs",
      },
    },
  ],

  bad: [
    {
      template: `
        <PluginOutlet @outletArgs={{hash foo="bar"}} />
      `,

      result: {
        column: 34,
        endColumn: 52,
        endLine: 2,
        filePath: "layout.hbs",
        line: 2,
        message:
          "Use {{lazyHash}} instead of {{hash}} for @outletArgs in <PluginOutlet>.",
        rule: "discourse/plugin-outlet-lazy-hash",
        severity: 2,
        source: '{{hash foo="bar"}}',
      },
    },
  ],
});
