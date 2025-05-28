import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-curly-components.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

ruleTester.run("no-curly-components", rule, {
  valid: [
    `
    import SomeComponent from 'foo/components/some-component';
    import AnotherComponent from 'foo/components/another-component';
    <template>
      <SomeComponent @arg1={{AnotherComponent}} />
    </template>
    `,
  ],
  invalid: [
    {
      name: "simple component",
      code: `
        import someComponent from "foo/components/some-component";
        <template>
          {{someComponent}}
          {{someComponent}}
        </template>
      `,
      errors: [
        {
          message: "Use angle bracket syntax for components.",
          type: "GlimmerMustacheStatement",
        },
        {
          message: "Use angle bracket syntax for components.",
          type: "GlimmerMustacheStatement",
        },
      ],
      output: `
        import someComponent from "foo/components/some-component";
        <template>
          <someComponent />
          <someComponent />
        </template>
      `,
    },
    {
      name: "component with arguments",
      code: `
        import someComponent from "foo/components/some-component";
        const someVariable = "value 🧑‍🧑‍🧒‍🧒";
        <template>
          {{someComponent arg1="value1" arg2=someVariable arg3=(if true "value3")}}
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
        const someVariable = "value 🧑‍🧑‍🧒‍🧒";
        <template>
          <someComponent @arg1={{"value1"}} @arg2={{someVariable}} @arg3={{if true "value3"}} />
        </template>
      `,
    },
    {
      name: "component with yield",
      code: `
        import someComponent from "foo/components/some-component";
        <template>
          {{#someComponent arg1="value1"}}
            <div>Content</div>
          {{/someComponent}}
        </template>
      `,
      errors: [
        {
          message: "Use angle bracket syntax for components.",
          type: "GlimmerBlockStatement",
        },
      ],
      output: `
        import someComponent from "foo/components/some-component";
        <template>
          <someComponent @arg1={{"value1"}} >
            <div>Content</div>
          </someComponent>
        </template>
      `,
    },
  ],
});
