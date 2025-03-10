import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-simple-query-selector.mjs";

const ruleTester = new RuleTester();

ruleTester.run("no-simple-query-selector", rule, {
  valid: [
    'document.querySelector(".my-class")',
    "document.body",
    "document.documentElement",
    'someOtherObject.querySelector("body")',
  ],
  invalid: [
    {
      code: 'document.querySelector("body")',
      errors: [
        {
          message:
            'Avoid using document.querySelector("body"). Use document.body instead.',
        },
      ],
      output: "document.body",
    },
    {
      code: 'document.querySelector("html")',
      errors: [
        {
          message:
            'Avoid using document.querySelector("html"). Use document.documentElement instead.',
        },
      ],
      output: "document.documentElement",
    },
  ],
});
