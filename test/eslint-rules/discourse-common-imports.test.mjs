import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/discourse-common-imports.mjs";

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2015, sourceType: "module" },
});

ruleTester.run("no-discourse-common-import", rule, {
  valid: [
    {
      code: `import Something from "discourse/lib/environment";`,
    },
  ],
  invalid: [
    {
      code: `import Something from "discourse-common/config/environment";`,
      errors: [
        {
          message:
            "Importing discourse-common/config/environment is no longer allowed. Use discourse/lib/environment instead.",
        },
      ],
      output: `import Something from "discourse/lib/environment";`,
    },
  ],
});
