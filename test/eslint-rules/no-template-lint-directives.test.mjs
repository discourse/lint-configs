import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-template-lint-directives.mjs";

const ruleTester = new RuleTester({
  languageOptions: { parser: EmberEslintParser },
});

ruleTester.run("no-template-lint-directives", rule, {
  valid: [
    // Unrelated Glimmer comment
    `<template>{{! just a comment }}<div></div></template>`,
    // Unrelated JS block comment
    `/* template-lint-disable no-log */ const x = 1;`,
  ],
  invalid: [
    {
      code: `<template>{{! template-lint-disable no-log }}{{log "x"}}</template>`,
      output: `<template>{{! eslint-disable ember/template-no-log }}{{log "x"}}</template>`,
      errors: [{ messageId: "convert" }],
    },
    {
      code: `<template>{{!-- template-lint-disable no-log --}}{{log "x"}}</template>`,
      output: `<template>{{!-- eslint-disable ember/template-no-log --}}{{log "x"}}</template>`,
      errors: [{ messageId: "convert" }],
    },
    {
      code: `<template>{{! template-lint-disable no-log no-debugger }}{{log "x"}}{{debugger}}</template>`,
      output: `<template>{{! eslint-disable ember/template-no-log, ember/template-no-debugger }}{{log "x"}}{{debugger}}</template>`,
      errors: [{ messageId: "convert" }],
    },
    {
      code: `<template>{{! template-lint-disable no-log}}{{log "x"}}</template>`,
      output: `<template>{{! eslint-disable ember/template-no-log }}{{log "x"}}</template>`,
      errors: [{ messageId: "convert" }],
    },
    {
      code: `<template>{{! template-lint-enable no-log }}{{log "x"}}</template>`,
      output: `<template>{{! eslint-enable ember/template-no-log }}{{log "x"}}</template>`,
      errors: [{ messageId: "convert" }],
    },
    // Directive inside an element's opening tag gets lifted to before the
    // element so the eslint-disable scope actually covers the element line.
    {
      code: `<template>
  <div
    class="x"
    {{! template-lint-disable no-invalid-interactive }}
    {{on "click" this.click}}
  ></div>
</template>`,
      output: `<template>
  {{! eslint-disable ember/template-no-invalid-interactive }}
  <div
    class="x"
    {{on "click" this.click}}
  ></div>
</template>`,
      errors: [{ messageId: "convert" }],
    },
  ],
});
