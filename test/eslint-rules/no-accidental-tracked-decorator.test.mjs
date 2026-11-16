import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-accidental-tracked-decorator.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

const error = { messageId: "returnsDecorator" };

ruleTester.run("no-accidental-tracked-decorator", rule, {
  valid: [
    {
      code: `
        import { tracked } from "@glimmer/tracking";
        const count = tracked(0);
        const empty = tracked(undefined);
        const badge = tracked({ description: "a run" }, {});
        const user = tracked({ name: "Zoey", value: 1 });
        const fromVariable = tracked(someObject);
        const descriptor = tracked(target, "foo", desc);
        class Counter {
          @tracked count = 0;
          @tracked({ equals: (a, b) => a === b }) total = 0;
        }
        const Person = EmberObject.extend({ name: tracked({ value: "Zoey" }) });
      `,
    },
    {
      code: `
        import { tracked } from "somewhere-else";
        const value = tracked();
      `,
    },
  ],

  invalid: [
    {
      code: `
        import { tracked as t } from "@glimmer/tracking";
        const a = t();
        const b = t({});
        const c = t({ description: "a run" });
        const d = t({ value: 1, "equals": isEqual });
      `,
      errors: [error, error, error, error],
    },
  ],
});
