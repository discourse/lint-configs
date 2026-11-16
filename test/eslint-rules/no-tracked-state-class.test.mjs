import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-tracked-state-class.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

const STATE_CLASS = `
  import { tracked } from "@glimmer/tracking";
  class State {
    @tracked value;
  }
`;

ruleTester.run("no-tracked-state-class", rule, {
  valid: [
    {
      // Not a `*-test` module
      filename: "frontend/discourse/tests/helpers/foo.gjs",
      code: STATE_CLASS,
    },
    {
      // Holds more than tracked fields
      filename: "frontend/discourse/tests/integration/foo-test.gjs",
      code: `
        import { tracked } from "@glimmer/tracking";
        import Service from "@ember/service";
        class WithCallback {
          @tracked value;
          onChange = (value) => (this.value = value);
        }
        class WithConstructor {
          @tracked value;
          constructor(value) {
            this.value = value;
          }
        }
        class Stub extends Service {
          @tracked value;
        }
      `,
    },
  ],

  invalid: [
    {
      filename: "plugins/chat/test/javascripts/components/foo-test.gjs",
      code: `
        import { tracked as t } from "@glimmer/tracking";
        class State {
          @t value;
        }
        const state = new (class {
          @t title = "First";
          @t level = 2;
        })();
      `,
      errors: [
        { messageId: "useTrackedValues" },
        { messageId: "useTrackedValues" },
      ],
    },
  ],
});
