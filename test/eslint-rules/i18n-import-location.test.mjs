import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/i18n-import-location.mjs";

const ruleTester = new RuleTester();

ruleTester.run("i18n-import-location", rule, {
  valid: [
    {
      code: "import { i18n } from 'discourse-i18n';",
    },
  ],
  invalid: [
    {
      code: "import { i18n } from 'i18n';",
      errors: [
        {
          message:
            "Import from 'i18n' is not allowed. Use 'discourse-i18n' instead.",
        },
      ],
      output: `import { i18n } from "discourse-i18n";`,
    },
    {
      code: "import i18n from 'discourse-common/helpers/i18n';",
      errors: [
        {
          message:
            "Import from 'discourse-common/helpers/i18n' is not allowed. Use 'discourse-i18n' instead.",
        },
      ],
      output: `import { i18n } from "discourse-i18n";`,
    },
    {
      code: "import i18n from 'discourse/helpers/i18n';",
      errors: [
        {
          message:
            "Import from 'discourse/helpers/i18n' is not allowed. Use 'discourse-i18n' instead.",
        },
      ],
      output: `import { i18n } from "discourse-i18n";`,
    },
    {
      code: "import i18n0 from 'discourse/helpers/i18n';",
      errors: [
        {
          message:
            "Import from 'discourse/helpers/i18n' is not allowed. Use 'discourse-i18n' instead.",
        },
      ],
      output: `import { i18n as i18n0 } from "discourse-i18n";`,
    },
    {
      code: `
        import i18n0 from 'discourse/helpers/i18n';
        import I18n from 'discourse-i18n';
      `.replace(/^\s*|\s*$/gm, ""),
      errors: [
        {
          message:
            "Import from 'discourse/helpers/i18n' is not allowed. Use 'discourse-i18n' instead.",
        },
      ],
      output: `\nimport I18n, { i18n as i18n0 } from "discourse-i18n";`,
    },
  ],
});
