import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/deprecated-plugin-apis.mjs";

const ruleTester = new RuleTester();

ruleTester.run("deprecated-plugin-apis", rule, {
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
    {
      code: `
        api.decoratePluginOutlet("below-footer", () => {
        });
      `,
      errors: [
        {
          message:
            "decoratePluginOutlet is deprecated. Use element modifiers on a component instead.",
        },
      ],
    },
  ],
});
