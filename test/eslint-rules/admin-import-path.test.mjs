import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/admin-import-path.mjs";

const ruleTester = new RuleTester();

ruleTester.run("admin-import-path", rule, {
  valid: [`import MyComponent from "discourse/admin/components/my-component";`],
  invalid: [
    {
      code: `import MyComponent from "admin/components/my-component";`,
      errors: [
        {
          message:
            "Use 'discourse/admin/components/my-component' instead of 'admin/components/my-component'",
        },
      ],
      output: `import MyComponent from "discourse/admin/components/my-component";`,
    },
  ],
});
