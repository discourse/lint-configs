import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/line-after-imports.mjs";

const ruleTester = new RuleTester();

ruleTester.run("line-after-imports", rule, {
  valid: [
    {
      code: `
        import x from "foo";

        class Y {}
      `,
    },
  ],
  invalid: [
    {
      code: `
        import x from "foo";
        import z from "bar";
        // test
        class Y {}
      `,
      errors: [{ message: "Expected blank line after imports." }],
      output: `
        import x from "foo";
        import z from "bar";

        // test
        class Y {}
      `,
    },
    {
      code: `
        import x from "foo";
        const xCopy = x;
        import z from "bar";
        const STRING = "hey";
        // test
        class Y {}
      `,
      errors: [{ message: "Expected blank line after imports." }],
      output: `
        import x from "foo";
        const xCopy = x;
        import z from "bar";

        const STRING = "hey";
        // test
        class Y {}
      `,
    },
  ],
});
