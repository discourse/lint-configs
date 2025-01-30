import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-simple-queryselector.mjs";

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 2018 } });

ruleTester.run("no-queryselector-body-html", rule, {
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
