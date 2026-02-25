import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/test-filename-suffix.mjs";

const ruleTester = new RuleTester();

ruleTester.run("test-filename-suffix", rule, {
  valid: [
    {
      code: "const ok = true;",
      filename: "frontend/discourse/tests/unit/foo-test.js",
    },
    {
      code: "export default class Foo {}",
      filename: "test/javascripts/integration/bar-test.gjs",
    },
    {
      code: "const ok = true;",
      filename: "test/javascripts/helpers/foo.js",
    },
  ],
  invalid: [
    {
      code: "const bad = true;",
      filename: "frontend/discourse/tests/unit/foo.js",
      errors: [{ message: "Test filenames must end with `-test`." }],
    },
    {
      code: "const bad = true;",
      filename: "test/javascripts/acceptance/bar.gjs",
      errors: [{ message: "Test filenames must end with `-test`." }],
    },
  ],
});
