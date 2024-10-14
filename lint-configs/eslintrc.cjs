"use strict";

/* eslint-env node */

// Copied from "ember-template-imports/lib/utils"
const TEMPLATE_TAG_PLACEHOLDER = "__GLIMMER_TEMPLATE";

module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:qunit/recommended",
    "plugin:ember/recommended",
  ],
  parser: "@babel/eslint-parser",
  env: {
    browser: true,
    builtin: true,
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    requireConfigFile: false,
    babelOptions: {
      plugins: [["@babel/plugin-proposal-decorators", { legacy: true }]],
    },
  },
  plugins: [
    "ember",
    "sort-class-members",
    "decorator-position",
    "simple-import-sort",
    "qunit",
  ],
  globals: {
    _: "off",
    $: "readonly", // covered by ember/no-global-jquery
    acceptance: "off",
    asyncRender: "off",
    Blob: "readonly",
    bootbox: "off",
    click: "off",
    count: "off",
    currentPath: "off",
    currentRouteName: "off",
    currentURL: "off",
    currentUser: "off",
    define: "readonly",
    Discourse: "off",
    Ember: "off",
    exists: "off",
    File: "readonly",
    fillIn: "off",
    find: "off",
    getSettledState: "off",
    globalThis: "readonly",
    hasModule: "off",
    invisible: "off",
    jQuery: "readonly", // covered by ember/no-global-jquery
    keyboardHelper: "off",
    keyEvent: "off",
    moduleFor: "off",
    moment: "readonly",
    pauseTest: "off",
    Pretender: "off",
    Promise: "readonly",
    query: "off",
    queryAll: "off",
    QUnit: "off",
    require: "readonly",
    requirejs: "readonly",
    sandbox: "off",
    sinon: "off",
    test: "off",
    testDone: "off",
    testStart: "off",
    triggerEvent: "off",
    visible: "off",
    visit: "off",
    waitUntil: "off",
  },
  rules: {
    "block-scoped-var": "error",
    eqeqeq: ["error", "allow-null"],
    "getter-return": "off",
    "guard-for-in": "error",
    "no-alert": "error",
    "no-bitwise": "error",
    "no-caller": "error",
    "no-case-declarations": "off",
    "no-cond-assign": "off",
    "no-console": "error",
    "no-constant-condition": "off",
    "no-control-regex": "off",
    "no-debugger": "error",
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-eval": "error",
    "no-extend-native": "error",
    "no-inner-declarations": "error",
    "no-irregular-whitespace": "error",
    "no-iterator": "error",
    "no-loop-func": "error",
    "no-misleading-character-class": "off",
    "no-mixed-spaces-and-tabs": "error",
    "no-multi-str": "error",
    "no-new": "error",
    "no-proto": "error",
    "no-prototype-builtins": "off",
    "no-regex-spaces": "off",
    "no-script-url": "error",
    "no-sequences": "error",
    "no-shadow": "error",
    "no-this-before-super": "error",
    "no-trailing-spaces": "error",
    "no-undef": "error",
    "no-unexpected-multiline": "off",
    "no-unused-vars": "error",
    "no-useless-escape": "off",
    "no-var": "error",
    "no-with": "error",
    radix: "error",
    semi: "error",
    "valid-typeof": "error",
    "wrap-iife": ["error", "inside"],
    curly: "error",
    "no-duplicate-imports": "error",
    "object-shorthand": ["error", "properties"],
    "no-dupe-class-members": "error",

    "ember/no-classic-components": "off",
    "ember/no-component-lifecycle-hooks": "off",
    "ember/require-tagless-components": "off",
    "ember/no-assignment-of-untracked-properties-used-in-tracking-contexts":
      "off",
    "ember/no-computed-properties-in-native-classes": "off",
    "ember/no-side-effects": "off",
    "ember/require-computed-property-dependencies": "off",
    "ember/require-return-from-computed": "off",
    "ember/use-brace-expansion": "off", // we no longer recommend using @computed
    "ember/no-deprecated-router-transition-methods": "off", // this rule is broken
    "ember/avoid-leaking-state-in-ember-objects": "off",
    "ember/no-get": "off",
    "ember/no-observers": "off",
    "ember/no-mixins": "off",
    "ember/no-new-mixins": "off",
    "ember/no-implicit-injections": "off", // this rule is broken
    "ember/no-array-prototype-extensions": "off",
    "ember/no-at-ember-render-modifiers": "off",
    "ember/classic-decorator-hooks": "off",
    "ember/classic-decorator-no-classic-methods": "off",
    "ember/no-actions-hash": "off",
    "ember/no-classic-classes": "off",
    "ember/no-tracked-properties-from-args": "off",
    "ember/no-jquery": "off",
    "ember/no-runloop": "off",
    "ember/no-capital-letters-in-routes": "off",
    "ember/no-controller-access-in-routes": "off",
    "ember/no-shadow-route-definition": "off",
    "ember/no-unnecessary-index-route": "off",
    "ember/no-unnecessary-service-injection-argument": "error",
    "ember/route-path-style": "off",
    "ember/routes-segments-snake-case": "off",
    "ember/no-replace-test-comments": "error",

    "qunit/no-assert-equal-boolean": "off",
    "qunit/no-assert-equal": "off",
    "qunit/no-conditional-assertions": "off",
    "qunit/no-identical-names": "off",
    "qunit/no-loose-assertions": "off",
    "qunit/no-negated-ok": "off",
    "qunit/no-ok-equality": "off",

    "sort-class-members/sort-class-members": [
      "error",
      {
        order: [
          "[static-properties]",
          "[static-methods]",
          "[injected-services]",
          "[injected-controllers]",
          "[tracked-properties]",
          "[properties]",
          "[private-properties]",
          "constructor",
          "[everything-else]",
          "[template-tag]",
        ],
        groups: {
          // https://github.com/ember-cli/eslint-plugin-ember/issues/1896
          // This only sort of works: in addition to the issues mentioned
          // above, it doesn't seem to reliably enforce the order, e.g.
          // [injected-services] -> <template> -> [injected-services]
          // doesn't seem to trigger the error. That being said, it does
          // work sometimes and this is needed to avoid emitting errors
          // in the limited cases where it does work.
          "template-tag": [
            { type: "property", name: `/${TEMPLATE_TAG_PLACEHOLDER}/` },
          ],
          "injected-services": [
            { groupByDecorator: "service", type: "property" },
            { groupByDecorator: "optionalService", type: "property" },
          ],
          "injected-controllers": [
            { groupByDecorator: "controller", type: "property" },
          ],
          "tracked-properties": [
            { groupByDecorator: "tracked", type: "property" },
          ],
          "private-properties": [
            { type: "property", private: true },
            { type: "property", name: "/_.+/" },
          ],
        },
        accessorPairPositioning: "getThenSet",
        stopAfterFirstProblem: false,
      },
    ],
    "decorator-position/decorator-position": ["error", { printWidth: 80 }],
    "simple-import-sort/imports": [
      "error",
      {
        groups: [
          [
            // Ember/glimmer
            "^@glimmer/",
            "^@ember/",
            // Any other packages ('longest match wins')
            "",
            // Internal
            "^discourse/",
            "^discourse-common/",
            "^discourse-.+",
            "^admin/",
            "^wizard/",
            "^I18n$",
            "^select-kit/",
            "^float-kit/",
            "^truth-helpers/",
            // Plugins
            "^discourse/plugins/",
            // Relative
            "^\\.\\./",
            "^\\./",
          ],
        ],
      },
    ],
  },

  overrides: [
    {
      files: ["**/*.gjs"],
      parser: "ember-eslint-parser",
      extends: ["plugin:ember/recommended-gjs"],
    },
  ],
};
