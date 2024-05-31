const { RuleTester } = require("eslint");
const rule = require("@discourse/lint-configs/eslint-rules/i18n-import");

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2015, sourceType: "module" },
});

ruleTester.run("no-i18n-import", rule, {
  valid: [
    {
      code: "import { t } from 'discourse-i18n';",
    },
  ],
  invalid: [
    {
      code: "import { t } from 'i18n';",
      errors: [
        {
          message:
            "Import from 'i18n' is not allowed. Use 'discourse-i18n' instead.",
        },
      ],
      output: "import { t } from 'discourse-i18n';",
    },
  ],
});
