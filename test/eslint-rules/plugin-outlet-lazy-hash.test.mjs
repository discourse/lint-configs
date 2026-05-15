import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/plugin-outlet-lazy-hash.mjs";

const ruleTester = new RuleTester({
  languageOptions: { parser: EmberEslintParser },
});

const message =
  "Use {{lazyHash}} instead of {{hash}} for @outletArgs in <PluginOutlet>.";

ruleTester.run("plugin-outlet-lazy-hash", rule, {
  valid: [
    `<template><PluginOutlet @outletArgs={{lazyHash foo="bar"}} /></template>`,
    `<template><PluginOutlet /></template>`,
  ],
  invalid: [
    {
      code: `<template><PluginOutlet @outletArgs={{hash foo="bar"}} /></template>`,
      errors: [{ message }],
    },
  ],
});
