import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/deprecated-imports.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("deprecated-imports", rule, {
  valid: [
    `import getUrl from "discourse/lib/get-url";`,
    `import { trustHTML } from "@ember/template";`,
    `import { isTrustedHTML } from "@ember/template";`,
    `import { isHTMLSafe } from "some-other-package";\nisHTMLSafe(value);`,
    `import { getOwner } from "@ember/owner";`,
    `import { isArray } from "@ember/array";`,
    `import { registerTransformer } from "discourse/lib/registry/transformers";`,
    // tracked-tools: already migrated
    `import { autoTrackedArray } from "discourse/lib/tracked-tools";`,
    // tracked-tools: different modules (import + usage untouched)
    `import { trackedArray } from "@ember/reactive/collections";\nconst arr = trackedArray([1]);`,
    `import { trackedArray } from "some-other-package";\nconst arr = trackedArray([1]);`,
    // tracked-tools: unrelated specifier
    `import { dedupeTracked } from "discourse/lib/tracked-tools";`,
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
      output: `import { trustHTML } from "@ember/template";`,
    },
    {
      code: `import { htmlSafe } from "@ember/template";`,
      errors: [
        {
          message:
            "'htmlSafe' is deprecated. Use 'trustHTML' from '@ember/template' instead.",
        },
      ],
      output: `import { trustHTML } from "@ember/template";`,
    },
    {
      code: `import { htmlSafe } from "@ember/template";\nhtmlSafe("<b>bold</b>");`,
      errors: [
        {
          message:
            "'htmlSafe' is deprecated. Use 'trustHTML' from '@ember/template' instead.",
        },
      ],
      output: `import { trustHTML } from "@ember/template";\ntrustHTML("<b>bold</b>");`,
    },
    {
      code: `import { htmlSafe as emberHtmlSafe } from "@ember/template";`,
      errors: [
        {
          message:
            "'htmlSafe' is deprecated. Use 'trustHTML' from '@ember/template' instead.",
        },
      ],
      output: `import { trustHTML as emberHtmlSafe } from "@ember/template";`,
    },
    {
      code: `import { htmlSafe, trustHTML } from "@ember/template";\nhtmlSafe(a) + trustHTML(b);`,
      errors: [
        {
          message:
            "'htmlSafe' is deprecated. Use 'trustHTML' from '@ember/template' instead.",
        },
      ],
      output: null,
    },

    // isHTMLSafe → isTrustedHTML
    {
      code: `import { isHTMLSafe } from "@ember/template";`,
      errors: [
        {
          message:
            "'isHTMLSafe' is deprecated. Use 'isTrustedHTML' from '@ember/template' instead.",
        },
      ],
      output: `import { isTrustedHTML } from "@ember/template";`,
    },
    {
      code: `import { isHTMLSafe } from "@ember/template";\nif (isHTMLSafe(value)) {}\nconst check = isHTMLSafe;`,
      errors: [
        {
          message:
            "'isHTMLSafe' is deprecated. Use 'isTrustedHTML' from '@ember/template' instead.",
        },
      ],
      output: `import { isTrustedHTML } from "@ember/template";\nif (isTrustedHTML(value)) {}\nconst check = isTrustedHTML;`,
    },
    {
      code: `import { isHTMLSafe as isSafe } from "@ember/template";\nisSafe(value);`,
      errors: [
        {
          message:
            "'isHTMLSafe' is deprecated. Use 'isTrustedHTML' from '@ember/template' instead.",
        },
      ],
      output: `import { isTrustedHTML as isSafe } from "@ember/template";\nisSafe(value);`,
    },
    {
      code: `import { htmlSafe, isHTMLSafe } from "@ember/template";`,
      errors: [
        {
          message:
            "'htmlSafe' is deprecated. Use 'trustHTML' from '@ember/template' instead.",
        },
        {
          message:
            "'isHTMLSafe' is deprecated. Use 'isTrustedHTML' from '@ember/template' instead.",
        },
      ],
      output: `import { trustHTML, isTrustedHTML } from "@ember/template";`,
    },
    {
      languageOptions: { parser: EmberEslintParser },
      filename: "component.gjs",
      code: `import { isHTMLSafe } from "@ember/template";\n<template>{{if (isHTMLSafe @html) "trusted"}}</template>`,
      errors: [
        {
          message:
            "'isHTMLSafe' is deprecated. Use 'isTrustedHTML' from '@ember/template' instead.",
        },
      ],
      output: `import { isTrustedHTML } from "@ember/template";\n<template>{{if (isTrustedHTML @html) "trusted"}}</template>`,
    },
    {
      // The new name is already imported, so a rename would declare it twice.
      code: `import { isHTMLSafe, isTrustedHTML } from "@ember/template";\nisHTMLSafe(a) || isTrustedHTML(b);`,
      errors: [
        {
          message:
            "'isHTMLSafe' is deprecated. Use 'isTrustedHTML' from '@ember/template' instead.",
        },
      ],
      output: null,
    },
    {
      // A local `isTrustedHTML` would capture the renamed reference.
      code: `import { isHTMLSafe } from "@ember/template";\nfunction check(isTrustedHTML, value) {\n  return isTrustedHTML && isHTMLSafe(value);\n}`,
      errors: [
        {
          message:
            "'isHTMLSafe' is deprecated. Use 'isTrustedHTML' from '@ember/template' instead.",
        },
      ],
      output: null,
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

    // trackedArray → autoTrackedArray: basic usage
    {
      code: `import { trackedArray } from "discourse/lib/tracked-tools";\nconst x = trackedArray;`,
      errors: [
        {
          message:
            "'trackedArray' is deprecated. Use 'autoTrackedArray' from 'discourse/lib/tracked-tools' instead.",
        },
      ],
      output: `import { autoTrackedArray } from "discourse/lib/tracked-tools";\nconst x = autoTrackedArray;`,
    },

    // trackedArray → autoTrackedArray: aliased import (alias preserved, no usage change)
    {
      code: `import { trackedArray as TA } from "discourse/lib/tracked-tools";\nconst x = TA;`,
      errors: [
        {
          message:
            "'trackedArray' is deprecated. Use 'autoTrackedArray' from 'discourse/lib/tracked-tools' instead.",
        },
      ],
      output: `import { autoTrackedArray as TA } from "discourse/lib/tracked-tools";\nconst x = TA;`,
    },

    // trackedArray → autoTrackedArray: with other specifiers (only trackedArray renamed)
    {
      code: `import { trackedArray, dedupeTracked } from "discourse/lib/tracked-tools";\nconst x = trackedArray;`,
      errors: [
        {
          message:
            "'trackedArray' is deprecated. Use 'autoTrackedArray' from 'discourse/lib/tracked-tools' instead.",
        },
      ],
      output: `import { autoTrackedArray, dedupeTracked } from "discourse/lib/tracked-tools";\nconst x = autoTrackedArray;`,
    },

    // trackedArray → autoTrackedArray: function call usage
    {
      code: `import { trackedArray } from "discourse/lib/tracked-tools";\nconst arr = trackedArray([1, 2]);`,
      errors: [
        {
          message:
            "'trackedArray' is deprecated. Use 'autoTrackedArray' from 'discourse/lib/tracked-tools' instead.",
        },
      ],
      output: `import { autoTrackedArray } from "discourse/lib/tracked-tools";\nconst arr = autoTrackedArray([1, 2]);`,
    },

    // trackedArray → autoTrackedArray: multiple usages
    {
      code: `import { trackedArray } from "discourse/lib/tracked-tools";\nconst a = trackedArray([1]);\nconst b = trackedArray([2]);`,
      errors: [
        {
          message:
            "'trackedArray' is deprecated. Use 'autoTrackedArray' from 'discourse/lib/tracked-tools' instead.",
        },
      ],
      output: `import { autoTrackedArray } from "discourse/lib/tracked-tools";\nconst a = autoTrackedArray([1]);\nconst b = autoTrackedArray([2]);`,
    },

    // trackedArray → autoTrackedArray: decorator usage
    {
      languageOptions: { parser: EmberEslintParser },
      code: `import { trackedArray } from "discourse/lib/tracked-tools";\nclass MyComponent {\n  @trackedArray items = [];\n}`,
      errors: [
        {
          message:
            "'trackedArray' is deprecated. Use 'autoTrackedArray' from 'discourse/lib/tracked-tools' instead.",
        },
      ],
      output: `import { autoTrackedArray } from "discourse/lib/tracked-tools";\nclass MyComponent {\n  @autoTrackedArray items = [];\n}`,
    },
  ],
});
