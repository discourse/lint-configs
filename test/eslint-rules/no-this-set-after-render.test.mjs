import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-this-set-after-render.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

const TEST_FILE = "frontend/discourse/tests/integration/foo-test.gjs";

ruleTester.run("no-this-set-after-render", rule, {
  valid: [
    {
      // Not a `*-test` module
      filename: "frontend/discourse/tests/helpers/foo.gjs",
      code: `
        import { render } from "@ember/test-helpers";
        async function setup() {
          await render(<template>{{this.title}}</template>);
          this.set("title", "b");
        }
      `,
    },
    {
      filename: TEST_FILE,
      code: `
        import { render } from "@ember/test-helpers";
        import { hbs } from "ember-cli-htmlbars";

        hooks.beforeEach(function () {
          this.update = (value) => this.set("query", value);
        });

        test("set before render", async function () {
          this.set("title", "a");
          await render(<template>{{this.title}}</template>);
          this.model.set("title", "b");
          const obj = {
            update() {
              this.set("title", "c");
            },
          };
        });

        test("no render", async function () {
          this.set("title", "b");
        });

        test("classic templates", async function () {
          this.set("onChange", (value) => this.set("value", value));
          await render(hbs\`{{foo onChange=this.onChange}}\`);
          await render(this.template);
          this.set("title", "b");
        });
      `,
    },
  ],

  invalid: [
    {
      filename: "plugins/chat/test/javascripts/components/foo-test.gjs",
      code: `
        import { render as renderComponent } from "@ember/test-helpers";
        test("after render", async function () {
          const onChange = (value) => {
            this.set("value", value);
          };
          const template = <template>{{this.title}}</template>;
          await renderComponent(template);
          this.set("title", "b");
          this.setProperties({ title: null });
        });
      `,
      errors: [
        { messageId: "inCallback", data: { method: "set" } },
        { messageId: "afterRender", data: { method: "set" } },
        { messageId: "afterRender", data: { method: "setProperties" } },
      ],
    },
  ],
});
