import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-at-class.mjs";

const ruleTester = new RuleTester({
  languageOptions: { parser: EmberEslintParser },
});

ruleTester.run("no-at-class", rule, {
  valid: [
    `<template><DButton class="foo" /></template>`,
    `<template><OtherComponent @class="foo" /></template>`,
  ],
  invalid: [
    {
      code: `<template><DButton @class="foo" /></template>`,
      errors: [
        {
          message: "Use `class` instead of `@class` for DButton.",
        },
      ],
      output: `<template><DButton class="foo" /></template>`,
    },
  ],
});
