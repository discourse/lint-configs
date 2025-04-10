import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/truth-helpers-imports.mjs";

const ruleTester = new RuleTester();

ruleTester.run("truth-helpers-imports", rule, {
  valid: [
    {
      code: "import { and, eq } from 'truth-helpers';",
    },
  ],
  invalid: [
    {
      code: "import not from 'truth-helpers/helpers/not';",
      errors: [
        {
          message:
            "It is recommended to use 'truth-helpers' import instead of 'truth-helpers/helpers/not'.",
        },
      ],
      output: "import { not } from 'truth-helpers';",
    },
    {
      code: "import notEq from 'truth-helpers/helpers/not-eq';",
      errors: [
        {
          message:
            "It is recommended to use 'truth-helpers' import instead of 'truth-helpers/helpers/not-eq'.",
        },
      ],
      output: "import { notEq } from 'truth-helpers';",
    },
    {
      code: "import or0 from 'truth-helpers/helpers/or';",
      errors: [
        {
          message:
            "It is recommended to use 'truth-helpers' import instead of 'truth-helpers/helpers/or'.",
        },
      ],
      output: "import { or as or0 } from 'truth-helpers';",
    },
  ],
});
