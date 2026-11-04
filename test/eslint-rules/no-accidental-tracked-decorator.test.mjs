import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-accidental-tracked-decorator.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

const NO_ARGUMENTS =
  "Use `tracked(undefined)` instead of `tracked()`: without arguments it returns a decorator, not a tracked value.";
const OPTIONS_SHAPED =
  "Pass options as a second argument, e.g. `tracked({}, {})`: a lone object with only `value`, `initializer`, `equals` or `description` keys returns a decorator, not a tracked value.";

ruleTester.run("no-accidental-tracked-decorator", rule, {
  valid: [
    {
      code: `
        import { tracked } from "@glimmer/tracking";
        const count = tracked(0);
        const empty = tracked(undefined);
        const options = tracked({}, {});
        const badge = tracked({ description: "a run" }, {});
        const user = tracked({ name: "Zoey", value: 1 });
        const fromVariable = tracked(someObject);
        const spread = tracked({ ...defaults });
      `,
    },
    {
      code: `
        import { tracked } from "@glimmer/tracking";
        class Counter {
          @tracked count = 0;
          @tracked() other;
          @tracked({ equals: (a, b) => a === b }) total = 0;
        }
      `,
    },
    {
      code: `
        import { tracked } from "@glimmer/tracking";
        import EmberObject from "@ember/object";
        const Person = EmberObject.extend({
          name: tracked({ value: "Zoey" }),
          age: tracked(),
        });
        Person.reopen({ nickname: tracked({ initializer: () => "Z" }) });
      `,
    },
    {
      code: `
        import { tracked } from "@glimmer/tracking";
        defineProperty(target, "foo", tracked(target, "foo", desc));
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
        import { tracked } from "@glimmer/tracking";
        const value = tracked();
      `,
      errors: [
        {
          message: NO_ARGUMENTS,
          suggestions: [
            {
              messageId: "useUndefined",
              output: `
        import { tracked } from "@glimmer/tracking";
        const value = tracked(undefined);
      `,
            },
          ],
        },
      ],
    },
    {
      code: `
        import { tracked as t } from "@glimmer/tracking";
        const options = t({});
      `,
      errors: [
        {
          message: OPTIONS_SHAPED,
          suggestions: [
            {
              messageId: "addOptions",
              output: `
        import { tracked as t } from "@glimmer/tracking";
        const options = t({}, {});
      `,
            },
          ],
        },
      ],
    },
    {
      code: `
        import { tracked } from "@glimmer/tracking";
        const badge = tracked({ description: "a run" });
        const settings = tracked({ value: 1, "equals": isEqual });
      `,
      errors: [
        {
          message: OPTIONS_SHAPED,
          suggestions: [
            {
              messageId: "addOptions",
              output: `
        import { tracked } from "@glimmer/tracking";
        const badge = tracked({ description: "a run" }, {});
        const settings = tracked({ value: 1, "equals": isEqual });
      `,
            },
          ],
        },
        {
          message: OPTIONS_SHAPED,
          suggestions: [
            {
              messageId: "addOptions",
              output: `
        import { tracked } from "@glimmer/tracking";
        const badge = tracked({ description: "a run" });
        const settings = tracked({ value: 1, "equals": isEqual }, {});
      `,
            },
          ],
        },
      ],
    },
    {
      filename: "frontend/discourse/tests/integration/components/foo-test.gjs",
      code: `
        import { tracked } from "@glimmer/tracking";
        import { render } from "@ember/test-helpers";
        import Foo from "discourse/components/foo";

        test("it works", async function () {
          const title = tracked();
          await render(<template><Foo @title={{title.value}} /></template>);
        });
      `,
      errors: [
        {
          message: NO_ARGUMENTS,
          suggestions: [
            {
              messageId: "useUndefined",
              output: `
        import { tracked } from "@glimmer/tracking";
        import { render } from "@ember/test-helpers";
        import Foo from "discourse/components/foo";

        test("it works", async function () {
          const title = tracked(undefined);
          await render(<template><Foo @title={{title.value}} /></template>);
        });
      `,
            },
          ],
        },
      ],
    },
  ],
});
