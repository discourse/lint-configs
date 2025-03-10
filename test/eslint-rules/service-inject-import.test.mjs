import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/service-inject-import.mjs";

const ruleTester = new RuleTester();

ruleTester.run("service-inject-import", rule, {
  valid: [`import { service } from "@ember/service";`],
  invalid: [
    {
      name: "simple",
      code: `import { inject as service } from "@ember/service";`,
      errors: [
        {
          message:
            "Use direct 'service' import instead of 'inject as service'.",
        },
      ],
      output: `import { service } from "@ember/service";`,
    },

    {
      name: "with default import as well",
      code: `import Service, { inject as service } from "@ember/service";`,
      errors: [
        {
          message:
            "Use direct 'service' import instead of 'inject as service'.",
        },
      ],
      output: `import Service, { service } from "@ember/service";`,
    },
  ],
});
