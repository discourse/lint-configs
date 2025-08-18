import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/deprecated-imports.mjs";

const ruleTester = new RuleTester();

ruleTester.run("deprecated-imports", rule, {
  valid: [
    `import getUrl from "discourse/lib/get-url";`,
    `import { htmlSafe } from "@ember/template";`,
    `import { getOwner } from "@ember/owner";`,
  ],
  invalid: [
    {
      code: `import getUrl from "discourse/helpers/get-url";`,
      errors: [
        {
          message:
            "Use 'discourse/lib/get-url' instead of 'discourse/helpers/get-url'",
        },
      ],
      output: `import getUrl from "discourse/lib/get-url";`,
    },
    {
      code: `import htmlSafe from "discourse/helpers/html-safe";`,
      errors: [
        {
          message:
            "Use '@ember/template' instead of 'discourse/helpers/html-safe'",
        },
      ],
      output: `import { htmlSafe } from "@ember/template";`,
    },
    {
      code: `import { getOwner } from "@ember/application";`,
      errors: [
        {
          message:
            "Use '@ember/owner' instead of '@ember/application' to import 'getOwner'",
        },
      ],
      output: `import { getOwner } from "@ember/owner";`,
    },
  ],
});
