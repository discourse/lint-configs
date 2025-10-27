import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/template-tag-no-self-this.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

ruleTester.run("template-tag-no-self-this", rule, {
  valid: [
    `
      const self = this;
      const context = {
        get category() {
          return self.category;
        },
      };
    `,
    `
      const self = this;
      const context = {
        get category() {
          return self.category;
        },
      };
      render(<template>{{self.category}}</template>);
    `,
    `
      const self = somethingElse;
      render(<template>{{self.category}}</template>);
    `,
    `
      const self = this;
      render(<template>{{self.category}}</template>);
      const somethingElse = self.category;
    `,
    `
      const self = this;
      class Foo {
        <template>{{self.category}}</template>
      }
    `,
    `
      const self = this;
      function foo() { return <template>{{self.category}}</template>; }
    `,
  ],
  invalid: [
    {
      code: `
        const self = this;
        render(<template>{{self.category}}</template>);
      `,
      errors: [
        {
          message:
            "Remove `self = this` and use `this` directly inside template tags.",
        },
      ],
      output: `
        
        render(<template>{{this.category}}</template>);
      `,
    },
    {
      code: `
        const self = this;
        render(<template>{{log self.category}}</template>);
      `,
      errors: [
        {
          message:
            "Remove `self = this` and use `this` directly inside template tags.",
        },
      ],
      output: `
        
        render(<template>{{log this.category}}</template>);
      `,
    },
  ],
});
