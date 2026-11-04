import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-this-set-after-render.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

const TEST_FILE =
  "frontend/discourse/tests/integration/components/foo-test.gjs";

function message(method) {
  return `Use a standalone \`tracked()\` value instead of \`this.${method}()\` after render: pass its \`.value\` to the template, assign a new \`.value\`, then \`await rerender()\`.`;
}

function callbackMessage(method) {
  return `Use a standalone \`tracked()\` value instead of \`this.${method}()\` in a callback: assign its \`.value\` (or a local variable, if the template doesn't read it).`;
}

ruleTester.run("no-this-set-after-render", rule, {
  valid: [
    {
      // Callbacks in a function that doesn't render a \`<template>\`
      filename: TEST_FILE,
      code: `
        import { render } from "@ember/test-helpers";
        import { hbs } from "ember-cli-htmlbars";
        hooks.beforeEach(function () {
          this.update = (value) => this.set("query", value);
        });
        test("classic", async function () {
          this.set("onChange", (value) => this.set("value", value));
          await render(hbs\`{{foo onChange=this.onChange}}\`);
        });
      `,
    },
    {
      // Not a test file
      filename: "frontend/discourse/app/components/foo.gjs",
      code: `
        import { render } from "@ember/test-helpers";
        async function setup() {
          await render(<template>{{this.title}}</template>);
          this.set("title", "b");
        }
      `,
    },
    {
      // Setting before render is fine
      filename: TEST_FILE,
      code: `
        import { render } from "@ember/test-helpers";
        test("before render", async function () {
          this.set("title", "a");
          this.setProperties({ level: 2 });
          await render(<template>{{this.title}}</template>);
        });
      `,
    },
    {
      // Classic hbs templates
      filename: TEST_FILE,
      code: `
        import { render } from "@ember/test-helpers";
        import { hbs } from "ember-cli-htmlbars";
        test("hbs", async function () {
          await render(hbs\`{{this.title}}\`);
          this.set("title", "b");
        });
      `,
    },
    {
      // A template that isn't a \`<template>\` tag, e.g. an hbs one set in a hook
      filename: TEST_FILE,
      code: `
        import { render } from "@ember/test-helpers";
        test("template on this", async function () {
          await render(this.template);
          this.set("title", "b");
        });
      `,
    },
    {
      // A separate test function
      filename: TEST_FILE,
      code: `
        import { render } from "@ember/test-helpers";
        test("first", async function () {
          await render(<template>{{this.title}}</template>);
        });
        test("second", async function () {
          this.set("title", "b");
        });
      `,
    },
    {
      // A nested function has its own \`this\`
      filename: TEST_FILE,
      code: `
        import { render } from "@ember/test-helpers";
        test("nested", async function () {
          await render(<template>{{this.title}}</template>);
          const obj = {
            update() {
              this.set("title", "b");
            },
          };
        });
      `,
    },
    {
      // \`render\` not imported from @ember/test-helpers
      filename: TEST_FILE,
      code: `
        import { render } from "somewhere-else";
        test("other render", async function () {
          await render(<template>{{this.title}}</template>);
          this.set("title", "b");
        });
      `,
    },
    {
      // Other objects' set
      filename: TEST_FILE,
      code: `
        import { render } from "@ember/test-helpers";
        test("model set", async function () {
          await render(<template>{{this.model.title}}</template>);
          this.model.set("title", "b");
        });
      `,
    },
  ],

  invalid: [
    {
      filename: TEST_FILE,
      code: `
        import { render } from "@ember/test-helpers";
        test("after render", async function () {
          this.set("title", "a");
          await render(<template>{{this.title}}</template>);
          this.set("title", "b");
          this.setProperties({ title: null, translatedTitle: "c" });
        });
      `,
      errors: [
        { message: message("set") },
        { message: message("setProperties") },
      ],
    },
    {
      filename: "plugins/foo/test/javascripts/integration/bar-test.gjs",
      code: `
        import { render as renderComponent } from "@ember/test-helpers";
        test("aliased render and arrow callbacks", async function () {
          const template = <template>{{this.date}}</template>;
          await renderComponent(template);
          const onChange = (date) => this.set("date", date);
        });
      `,
      errors: [{ message: callbackMessage("set") }],
    },
    {
      filename: "plugins/chat/test/javascripts/components/foo-test.gjs",
      code: `
        import { render } from "@ember/test-helpers";
        test("plugin component tests", async function () {
          await render(<template>{{this.count}}</template>);
          this.set("count", 2);
        });
      `,
      errors: [{ message: message("set") }],
    },
    {
      // Callbacks run after render even when defined before it
      filename: TEST_FILE,
      code: `
        import { render } from "@ember/test-helpers";
        test("write-back callback", async function () {
          this.setProperties({
            value: "a",
            onChange: (value) => {
              this.set("value", value);
            },
          });
          await render(
            <template><Foo @onChange={{this.onChange}} @value={{this.value}} /></template>
          );
        });
      `,
      errors: [{ message: callbackMessage("set") }],
    },
    {
      // A render that isn't awaited right away
      filename: TEST_FILE,
      code: `
        import { render } from "@ember/test-helpers";
        test("pending render", async function () {
          const rendered = render(<template>{{this.options}}</template>);
          this.set("options", { schema: {} });
          await rendered;
        });
      `,
      errors: [{ message: message("set") }],
    },
  ],
});
