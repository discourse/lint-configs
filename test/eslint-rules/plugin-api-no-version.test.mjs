import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/plugin-api-no-version.mjs";

const ruleTester = new RuleTester();

ruleTester.run("plugin-api-no-version", rule, {
  valid: [`apiInitializer(() => {});`, `withPluginApi(() => {});`],
  invalid: [
    {
      code: `apiInitializer("0.8", () => {});`,
      errors: [
        {
          message:
            "Specifying plugin api version in apiInitializer is no longer necessary",
        },
      ],
      output: `apiInitializer(() => {});`,
    },
    {
      code: `
withPluginApi(
  "1.8.0",
  () => {}
);
`,
      errors: [
        {
          message:
            "Specifying plugin api version in withPluginApi is no longer necessary",
        },
      ],
      output: `
withPluginApi(
  () => {}
);
`,
    },
  ],
});
