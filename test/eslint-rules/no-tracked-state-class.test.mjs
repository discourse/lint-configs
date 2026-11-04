import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-tracked-state-class.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

const TEST_FILE =
  "frontend/discourse/tests/integration/components/foo-test.gjs";

function message(name) {
  return `Use standalone \`tracked()\` values instead of a class that only holds \`@tracked\` fields: \`const ${name} = tracked(…)\`, then read and assign \`${name}.value\`.`;
}

ruleTester.run("no-tracked-state-class", rule, {
  valid: [
    {
      // Not a test file
      filename: "frontend/discourse/app/components/foo.gjs",
      code: `
        import { tracked } from "@glimmer/tracking";
        class State {
          @tracked value;
        }
      `,
    },
    {
      // A test helper module, not a test
      filename: "frontend/discourse/tests/helpers/rich-editor-helper.gjs",
      code: `
        import { tracked } from "@glimmer/tracking";
        export const state = new (class {
          @tracked value;
        })();
      `,
    },
    {
      // Holds more than tracked state
      filename: TEST_FILE,
      code: `
        import { tracked } from "@glimmer/tracking";
        const state = new (class {
          @tracked value = "";
          changes = [];
          onChange = (event) => this.changes.push(event);
        })();
        class Harness {
          @tracked items;
          append(item) {
            this.items = [...this.items, item];
          }
        }
        class WithGetter {
          @tracked count = 0;
          get double() {
            return this.count * 2;
          }
        }
      `,
    },
    {
      // Constructor does more than initialize fields
      filename: TEST_FILE,
      code: `
        import { tracked } from "@glimmer/tracking";
        class State {
          @tracked value;
          constructor(value) {
            this.value = value;
            this.calls = [];
          }
        }
      `,
    },
    {
      // Extended in the same file
      filename: TEST_FILE,
      code: `
        import { tracked } from "@glimmer/tracking";
        class TabsState {
          @tracked active;
        }
        class ExtraTabsState extends TabsState {
          extra = true;
        }
      `,
    },
    {
      // Subclasses, plain classes and unimported decorators are out of scope
      filename: TEST_FILE,
      code: `
        import { tracked } from "@glimmer/tracking";
        import Service from "@ember/service";
        class Stub extends Service {
          @tracked value;
        }
        class Plain {
          value = 1;
        }
      `,
    },
    {
      filename: TEST_FILE,
      code: `
        class State {
          @tracked value;
        }
      `,
    },
  ],

  invalid: [
    {
      filename: TEST_FILE,
      code: `
        import { tracked } from "@glimmer/tracking";
        const state = new (class {
          @tracked title = "First";
          @tracked level = 2;
        })();
      `,
      errors: [{ message: message("title") }],
    },
    {
      filename: "plugins/foo/test/javascripts/components/bar-test.gjs",
      code: `
        import { tracked } from "@glimmer/tracking";
        class State {
          @tracked value = "a|b";
        }
      `,
      errors: [{ message: message("value") }],
    },
    {
      filename: TEST_FILE,
      code: `
        import { tracked as t } from "@glimmer/tracking";
        class TestField {
          @t value;

          constructor(value) {
            this.value = value;
          }
        }
      `,
      errors: [{ message: message("value") }],
    },
  ],
});
