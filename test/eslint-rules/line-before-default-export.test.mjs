import EmberESLintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/line-before-default-export.mjs";

const ruleTester = new RuleTester({
  languageOptions: { parser: EmberESLintParser },
});

ruleTester.run("line-before-default-export", rule, {
  valid: [
    {
      code: `
        const Foo = <template>
          test
        </template>;

        export default Foo;
      `,
    },
    {
      code: `
        const A = "b";

        @className("foo")
        export default class Foo {};
      `,
    },
  ],
  invalid: [
    {
      code: `
        const Foo = <template>
          test
        </template>;
        export default Foo;
      `,
      errors: [{ message: "Expected blank line before the default export." }],
      output: `
        const Foo = <template>
          test
        </template>;

        export default Foo;
      `,
    },
  ],
});
