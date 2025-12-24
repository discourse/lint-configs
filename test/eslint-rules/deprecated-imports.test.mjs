import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/deprecated-imports.mjs";

const ruleTester = new RuleTester();

ruleTester.run("deprecated-imports", rule, {
  valid: [
    `import getUrl from "discourse/lib/get-url";`,
    `import { htmlSafe } from "@ember/template";`,
    `import { getOwner } from "@ember/owner";`,
    `import { isArray } from "@ember/array";`,
    `import { registerTransformer } from "discourse/lib/registry/transformers";`,
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
      code: `import { VALUE_TRANSFORMERS } from "discourse/lib/transformer/registry";`,
      errors: [
        {
          message:
            "Use 'discourse/lib/registry/transformers' instead of 'discourse/lib/transformer/registry'",
        },
      ],
      output: `import { VALUE_TRANSFORMERS } from "discourse/lib/registry/transformers";`,
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
    {
      code: `import { A } from "@ember/array";`,
      errors: [
        {
          message:
            "Importing 'A' from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import { A as emberArray } from "@ember/array";`,
      errors: [
        {
          message:
            "Importing 'A' from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import { NativeArray } from "@ember/array";`,
      errors: [
        {
          message:
            "Importing 'NativeArray' from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import { NativeArray as EmberNativeArray } from "@ember/array";`,
      errors: [
        {
          message:
            "Importing 'NativeArray' from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import { MutableArray } from "@ember/array";`,
      errors: [
        {
          message:
            "Importing 'MutableArray' from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import { MutableArray as EmberMutableArray } from "@ember/array";`,
      errors: [
        {
          message:
            "Importing 'MutableArray' from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import { A, isArray, NativeArray } from "@ember/array";`,
      errors: [
        {
          message:
            "Importing 'A' from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
        {
          message:
            "Importing 'NativeArray' from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import { A as emberA, makeArray, MutableArray as EmberMutable } from "@ember/array";`,
      errors: [
        {
          message:
            "Importing 'A' from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
        {
          message:
            "Importing 'MutableArray' from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import EmberArray from "@ember/array";`,
      errors: [
        {
          message:
            "Importing EmberArray (default) from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import A from "@ember/array";`,
      errors: [
        {
          message:
            "Importing EmberArray (default) from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import MutableArray from "@ember/array/mutable";`,
      errors: [
        {
          message:
            "Importing MutableArray (default) from '@ember/array/mutable' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import EmberMutableArray from "@ember/array/mutable";`,
      errors: [
        {
          message:
            "Importing MutableArray (default) from '@ember/array/mutable' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import ArrayProxy from "@ember/array/proxy";`,
      errors: [
        {
          message:
            "Importing ArrayProxy (default) from '@ember/array/proxy' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
    {
      code: `import EmberArrayProxy from "@ember/array/proxy";`,
      errors: [
        {
          message:
            "Importing ArrayProxy (default) from '@ember/array/proxy' is deprecated. Use tracked arrays or native JavaScript arrays instead.",
        },
      ],
      output: null,
    },
  ],
});
