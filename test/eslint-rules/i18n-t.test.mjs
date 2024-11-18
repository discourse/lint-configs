import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/i18n-t.mjs";

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2015, sourceType: "module" },
});

ruleTester.run("i18n-t", rule, {
  valid: [
    {
      name: "Simple i18n",
      code: [
        "import { i18n } from 'discourse-i18n';",
        'i18n("some string");',
      ].join("\n"),
    },
    {
      name: "i18n and I18n.messageFormat",
      code: [
        "import I18n, { i18n } from 'discourse-i18n';",
        'i18n("some string");',
        'I18n.messageFormat("some string");',
      ].join("\n"),
    },
  ],
  invalid: [
    {
      name: "Simple I18n.t",
      code: [
        "import I18n from 'discourse-i18n';",
        'I18n.t("some string");',
        'I18n.t("some string");',
      ].join("\n"),
      errors: [
        {
          message: "Use 'i18n(...)' instead of 'I18n.t(...)'.",
        },
        {
          message: "Use 'i18n(...)' instead of 'I18n.t(...)'.",
        },
      ],
      output: [
        "import { i18n } from 'discourse-i18n';",
        'i18n("some string");',
        'i18n("some string");',
      ].join("\n"),
    },
    {
      name: "I18n.t and I18n.messageFormat",
      code: [
        "import I18n from 'discourse-i18n';",
        'I18n.t("some string");',
        'I18n.t("some string");',
        'I18n.messsageFormat("some string");',
      ].join("\n"),
      errors: [
        {
          message: "Use 'i18n(...)' instead of 'I18n.t(...)'.",
        },
        {
          message: "Use 'i18n(...)' instead of 'I18n.t(...)'.",
        },
      ],
      output: [
        "import I18n, { i18n } from 'discourse-i18n';",
        'i18n("some string");',
        'i18n("some string");',
        'I18n.messsageFormat("some string");',
      ].join("\n"),
    },
    {
      name: "mix of I18n.t and i18n",
      code: [
        "import I18n, { i18n } from 'discourse-i18n';",
        'I18n.t("some string");',
        'i18n("some string");',
      ].join("\n"),
      errors: [
        {
          message: "Use 'i18n(...)' instead of 'I18n.t(...)'.",
        },
      ],
      output: [
        "import { i18n } from 'discourse-i18n';",
        'i18n("some string");',
        'i18n("some string");',
      ].join("\n"),
    },
  ],
});
