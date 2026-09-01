import EmberESLintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/lines-between-class-members.mjs";

const ruleTester = new RuleTester({
  languageOptions: { parser: EmberESLintParser },
});

ruleTester.run("lines-between-class-members", rule, {
  valid: [
    {
      code: `
        class Foo {
          get baz() {
            return 0;
          }

          @action quux() {
            return 1;
          }

          <template></template>
        }
      `,
    },
    {
      code: `
        class Foo {
          @tracked bar;
          @tracked baz;

          <template></template>
        }
      `,
    },
    {
      code: `
        class Foo {
          @tracked bar;

          <template></template>
        }
      `,
    },
    {
      code: `
        class Foo {
          @service bar;
          @service baz;
          @service("the-q") quux;
          @optionalService hey;
          @optionalService("yo") hey;
          @controller hello;
          @controller("greeter") welcome;

          <template></template>
        }
      `,
    },
    {
      code: `
        class Foo {
          @tracked bar;

          /**
           * Documented.
           */
          @tracked baz;

          /* plain block */
          quux = 1;
        }
      `,
    },
    {
      code: `
        class Foo {
          /**
           * First member may follow the brace directly.
           */
          @tracked bar;
          // line comments do not require padding
          @tracked baz;
        }
      `,
    },
  ],
  invalid: [
    {
      code: `
        class Foo {
          @tracked bar;
          <template></template>
        }
      `,
      errors: [{ message: "Expected blank line between class members." }],
      output: `
        class Foo {
          @tracked bar;

          <template></template>
        }
      `,
    },
    {
      code: `
        class Foo {
          get baz() {
            return 0;
          }
          <template></template>
        }
      `,
      errors: [{ message: "Expected blank line between class members." }],
      output: `
        class Foo {
          get baz() {
            return 0;
          }

          <template></template>
        }
      `,
    },
    {
      code: `
        class Foo {
          @service modal;
          @service store;
          @tracked counter;
          @tracked text;
        }
      `,
      errors: [{ message: "Expected blank line between class members." }],
      output: `
        class Foo {
          @service modal;
          @service store;

          @tracked counter;
          @tracked text;
        }
      `,
    },
    {
      code: `
        class Foo {
          @service modal;
          @tracked counter;
          @tracked text;
          other = 0;
          get bar() {
            return 1;
          }
          @action alert() {
            return 2;
          }
          <template></template>
        }
      `,
      errors: [
        { message: "Expected blank line between class members." },
        { message: "Expected blank line between class members." },
        { message: "Expected blank line between class members." },
        { message: "Expected blank line between class members." },
      ],
      output: `
        class Foo {
          @service modal;

          @tracked counter;
          @tracked text;
          other = 0;

          get bar() {
            return 1;
          }

          @action alert() {
            return 2;
          }

          <template></template>
        }
      `,
    },
    {
      code: `
        class Foo {
          @tracked bar;
          /**
           * Documented.
           */
          @tracked baz;
          /* plain block */
          quux = 1;
        }
      `,
      errors: [
        { message: "Expected blank line between class members." },
        { message: "Expected blank line between class members." },
      ],
      output: `
        class Foo {
          @tracked bar;

          /**
           * Documented.
           */
          @tracked baz;

          /* plain block */
          quux = 1;
        }
      `,
    },
  ],
});
