import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-register-connector-class.mjs";

const ruleTester = new RuleTester();

ruleTester.run("no-register-connector-class", rule, {
  valid: [
    "api.renderInOutlet('user-profile-primary', MyComponent)",
    "someObject.registerConnectorClass()",
  ],
  invalid: [
    {
      code: `
        api.registerConnectorClass("above-main-container", "homepage", {
          setupComponent(args, component) {
          }
        });
      `,
      errors: [
        {
          message:
            "registerConnectorClass is deprecated. Create a glimmer component in a plugin connector directory or use renderInOutlet instead.",
        },
      ],
    },
  ],
});
