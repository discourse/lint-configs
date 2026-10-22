import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/truth-helpers-keywords.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

function useKeyword(keyword, name = keyword) {
  return {
    message: `Use the built-in \`${keyword}\` template keyword instead of importing \`${name}\`.`,
  };
}

ruleTester.run("truth-helpers-keywords", rule, {
  valid: [
    `import { has, includes } from "discourse/truth-helpers";`,
    `import { and } from "my-helpers";`,
  ],
  invalid: [
    {
      name: "removes the whole import",
      code: `import Component from "@glimmer/component";
import { and, eq } from "discourse/truth-helpers";

export default class Foo extends Component {
  <template>{{if (and @a (eq @b 1)) "yes"}}</template>
}`,
      errors: [useKeyword("and"), useKeyword("eq")],
      output: `import Component from "@glimmer/component";


export default class Foo extends Component {
  <template>{{if (and @a (eq @b 1)) "yes"}}</template>
}`,
    },
    {
      name: "keeps helpers without a keyword",
      code: `import { and, has } from "discourse/truth-helpers";
<template>{{if (and @a (has @set 1)) "yes"}}</template>`,
      errors: [useKeyword("and")],
      output: `import { has } from "discourse/truth-helpers";
<template>{{if (and @a (has @set 1)) "yes"}}</template>`,
    },
    {
      name: "renames notEq to neq",
      code: `import { notEq } from "discourse/truth-helpers";
<template>{{if (notEq @a @b) "different"}}</template>`,
      errors: [useKeyword("neq", "notEq")],
      output: `
<template>{{if (neq @a @b) "different"}}</template>`,
    },
    {
      name: "renames an aliased import",
      code: `import { or as either } from "discourse/truth-helpers";
<template>{{either @a @b}}</template>`,
      errors: [useKeyword("or", "either")],
      output: `
<template>{{or @a @b}}</template>`,
    },
    {
      name: "handles the legacy import path",
      code: `import { gt } from "truth-helpers";
<template>{{if (gt @a 1) "big"}}</template>`,
      errors: [useKeyword("gt")],
      output: `
<template>{{if (gt @a 1) "big"}}</template>`,
    },
  ],
});
