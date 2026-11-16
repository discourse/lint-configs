import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-test-context-set.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

const TEST_FILE = "frontend/discourse/tests/integration/foo-test.gjs";

ruleTester.run("no-test-context-set", rule, {
  valid: [
    {
      // Not a `*-test` module
      filename: "frontend/discourse/tests/helpers/foo.gjs",
      code: `test("a", function () { this.set("title", "a"); });`,
    },
    {
      // Not the test context
      filename: TEST_FILE,
      code: `
        test("a", async function () {
          this.model.set("title", "a");
          const component = Component.extend({
            click() {
              this.set("clicked", true);
            },
          });
        });
        function setTitle() {
          this.set("title", "a");
        }
      `,
    },
  ],

  invalid: [
    {
      // Before render: native assignment
      filename: TEST_FILE,
      code: `
        hooks.beforeEach(function () {
          this.set("title", "a");
        });
        test("a", async function () {
          this.set("user.name", "b");
          this.set("data-id", 1);
          this.setProperties({ level: 2, label });
          this.setProperties(defaults);
          this.set(key, 3);
          await render(<template>{{this.title}}</template>);
        });
      `,
      output: `
        hooks.beforeEach(function () {
          this.title = "a";
        });
        test("a", async function () {
          this.user.name = "b";
          this["data-id"] = 1;
          this.level = 2;
          this.label = label;
          Object.assign(this, defaults);
          this.set(key, 3);
          await render(<template>{{this.title}}</template>);
        });
      `,
      errors: [
        { messageId: "useAssignment", data: { method: "set" } },
        { messageId: "useAssignment", data: { method: "set" } },
        { messageId: "useAssignment", data: { method: "set" } },
        { messageId: "useAssignment", data: { method: "setProperties" } },
        { messageId: "useAssignment", data: { method: "setProperties" } },
        { messageId: "useAssignment", data: { method: "set" } },
      ],
    },
    {
      // After an await, or in a callback: `tracked()`, no autofix
      filename: "plugins/chat/test/javascripts/components/foo-test.gjs",
      code: `
        test("a", async function () {
          const onChange = (value) => this.set("value", value);
          await render(<template>{{this.value}}</template>);
          this.setProperties({ value: "b" });
        });
      `,
      output: null,
      errors: [
        { messageId: "useTracked", data: { method: "set" } },
        { messageId: "useTracked", data: { method: "setProperties" } },
      ],
    },
  ],
});
