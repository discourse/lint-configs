import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/deprecated-lookups.mjs";

const ruleTester = new RuleTester();

ruleTester.run("deprecated-lookups", rule, {
  valid: [
    `someObject.lookup("service:store")`,
    `api.modifyClass("service:store", {})`,
    `api.modifyClassStatic("service:store", {})`,
  ],
  invalid: [
    {
      code: `someObject.lookup("store:main")`,
      errors: [{ message: "Use 'service:store' instead of 'store:main'" }],
      output: `someObject.lookup("service:store")`,
    },
    {
      code: `api.modifyClass("store:main", {})`,
      errors: [{ message: "Use 'service:store' instead of 'store:main'" }],
      output: `api.modifyClass("service:store", {})`,
    },
    {
      code: `api.modifyClassStatic("search-service:main", {})`,
      errors: [
        { message: "Use 'service:search' instead of 'search-service:main'" },
      ],
      output: `api.modifyClassStatic("service:search", {})`,
    },
    {
      code: `api.modifyClass("key-value-store:main", {})`,
      errors: [
        {
          message:
            "Use 'service:key-value-store' instead of 'key-value-store:main'",
        },
      ],
      output: `api.modifyClass("service:key-value-store", {})`,
    },
    {
      code: `api.modifyClassStatic("pm-topic-tracking-state:main", {})`,
      errors: [
        {
          message:
            "Use 'service:pm-topic-tracking-state' instead of 'pm-topic-tracking-state:main'",
        },
      ],
      output: `api.modifyClassStatic("service:pm-topic-tracking-state", {})`,
    },
  ],
});
