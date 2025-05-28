import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/angle-bracket-components.mjs";
import EmberEslintParser from "ember-eslint-parser";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

ruleTester.run("angle-bracket-components", rule, {
  valid: [],
  invalid: [
    {
      code: `
        import someComponent from "foo/components/some-component";
        <template>
          {{someComponent}}
        </template>
      `,
      errors: [
        {
          message: "Use angle bracket syntax for components.",
          type: "GlimmerMustacheStatement",
        },
      ],
      output: `
        import someComponent from "foo/components/some-component";
        <template>
          <someComponent />
        </template>
      `,
    },
  ],
});
