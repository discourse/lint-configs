import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/capital-components.mjs";
import EmberEslintParser from "ember-eslint-parser";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

ruleTester.run("capital-components", rule, {
  valid: [],
  invalid: [
    {
      name: "simple component",
      code: `
        import someComponent from "foo/components/some-component";
        const someVariable = someComponent;
        <template>
          <someComponent />
          <someComponent />
        </template>
      `,
      errors: [
        {
          message: "Component names should start with a capital letter.",
        },
        {
          message: "Component names should start with a capital letter.",
        },
      ],
      output: `
        import SomeComponent from "foo/components/some-component";
        const someVariable = SomeComponent;
        <template>
          <SomeComponent />
          <SomeComponent />
        </template>
      `,
    },
  ],
});
