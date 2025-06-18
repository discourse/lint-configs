import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/theme-imports.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

ruleTester.run("theme-imports", rule, {
  valid: [],
  invalid: [
    {
      name: "replacing themeSetting",
      code: `
import themeSetting from "discourse/helpers/theme-setting";
<template>
  {{themeSetting "quux"}}
  {{if (themeSetting "foo.bar") "yes" "no"}}
</template>
`,
      errors: [{ message: "Importing themeSetting is not allowed." }],
      output: `
import { get } from "@ember/object";
<template>
  {{get settings "quux"}}
  {{if (get settings "foo.bar") "yes" "no"}}
</template>
`,
    },

    {
      name: "replacing themeI18n",
      code: `
import themeI18n from "discourse/helpers/theme-i18n";
<template>
  {{themeI18n "baz"}}
  {{log (themeI18n "bar")}}
</template>
`,
      errors: [{ message: "Importing themeI18n is not allowed." }],
      output: `
import { i18n } from "discourse-i18n";
<template>
  {{i18n (themePrefix "baz")}}
  {{log (i18n (themePrefix "bar"))}}
</template>
`,
    },

    {
      name: "replacing themePrefix",
      code: `
import prefix from "discourse/helpers/theme-prefix";
<template>
  {{prefix "baz"}}
  {{log (prefix "bar")}}
</template>
`,
      errors: [{ message: "Importing themePrefix is not allowed." }],
      output: `

<template>
  {{themePrefix "baz"}}
  {{log (themePrefix "bar")}}
</template>
`,
    },

    {
      name: "replacing renamed themeI18n and where i18n exists",
      code: `
import { i18n } from "discourse-i18n";
import { default as t } from "discourse/helpers/theme-i18n";
<template>
  {{i18n "foo"}}
  {{t "bar"}}
  {{log (t "bar")}}
</template>
`,
      errors: [{ message: "Importing themeI18n is not allowed." }],
      output: `
import { i18n } from "discourse-i18n";

<template>
  {{i18n "foo"}}
  {{i18n (themePrefix "bar")}}
  {{log (i18n (themePrefix "bar"))}}
</template>
`,
    },

    {
      name: "bloop",
      code: `
import themeSetting from "discourse/helpers/theme-setting";
<template>
{{#let
  (themeSetting (concat "featured_card_image_" index))
  as |theme-image|
}}
  {{theme-image}}
{{/let}}
</template>
      `,
      errors: [{ message: "Importing themeSetting is not allowed." }],
      output: `
import { get } from "@ember/object";
<template>
{{#let
  (get settings (concat "featured_card_image_" index))
  as |theme-image|
}}
  {{theme-image}}
{{/let}}
</template>
      `,
    },
  ],
});
