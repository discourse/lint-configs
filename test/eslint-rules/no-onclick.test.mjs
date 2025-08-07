import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-onclick.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

ruleTester.run("no-onclick", rule, {
  valid: [],
  invalid: [
    {
      code: `
        <template>
          <SomeComponent onclick={{this.foo}} />
        </template>
      `,
      errors: [
        {
          message:
            'Do not use `onclick` attribute. Use `{{on "click" ...}}` modifier instead.',
        },
      ],
    },
  ],
});
