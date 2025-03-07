import { createConfigItem } from "@babel/core";
import BabelParser from "@babel/eslint-parser";
import PluginProposalDecorators from "@babel/plugin-proposal-decorators";
import js from "@eslint/js";
import stylisticJs from "@stylistic/eslint-plugin-js";
import EmberESLintParser from "ember-eslint-parser";
import DecoratorPosition from "eslint-plugin-decorator-position";
import EmberPlugin from "eslint-plugin-ember";
import EmberRecommended from "eslint-plugin-ember/configs/recommended";
import ImportPlugin from "eslint-plugin-import";
import QUnitPlugin from "eslint-plugin-qunit";
import QUnitRecommended from "eslint-plugin-qunit/configs/recommended";
import SimpleImportSort from "eslint-plugin-simple-import-sort";
import SortClassMembers from "eslint-plugin-sort-class-members";
import globals from "globals";
import deprecatedLookups from "./eslint-rules/deprecated-lookups.mjs";
import discourseCommonImports from "./eslint-rules/discourse-common-imports.mjs";
import i18nImport from "./eslint-rules/i18n-import-location.mjs";
import i18nT from "./eslint-rules/i18n-t.mjs";
import noSimpleQueryselector from "./eslint-rules/no-simple-queryselector.mjs";
import serviceInjectImport from "./eslint-rules/service-inject-import.mjs";

// Copied from "ember-template-imports/lib/utils"
const TEMPLATE_TAG_PLACEHOLDER = "__GLIMMER_TEMPLATE";

export default [
  js.configs.recommended,
  QUnitRecommended,
  ...EmberRecommended,
  {
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: "module",
      parser: BabelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          plugins: [
            createConfigItem([
              PluginProposalDecorators,
              { legacy: true },
              "@babel/plugin-proposal-decorators",
            ]),
          ],
        },
      },

      globals: {
        ...globals.browser,
        ...globals.node,
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
    },
    plugins: {
      "@stylistic/js": stylisticJs,
      ember: EmberPlugin,
      "sort-class-members": SortClassMembers,
      "decorator-position": DecoratorPosition,
      "simple-import-sort": SimpleImportSort,
      qunit: QUnitPlugin,
      import: ImportPlugin,
      discourse: {
        rules: {
          "i18n-import-location": i18nImport,
          "i18n-t": i18nT,
          "service-inject-import": serviceInjectImport,
          "no-simple-queryselector": noSimpleQueryselector,
          "deprecated-lookups": deprecatedLookups,
          "discourse-common-imports": discourseCommonImports,
        },
      },
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
      "import/no-duplicates": "error",
      "object-shorthand": ["error", "properties"],
      "no-dupe-class-members": "error",
      "@stylistic/js/lines-between-class-members": [
        "error",
        {
          enforce: [
            { blankLine: "always", prev: "*", next: "method" },
            { blankLine: "always", prev: "method", next: "*" },
          ],
        },
        { exceptAfterSingleLine: true },
      ],
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
      "qunit/no-assert-equal": "off",
      "qunit/no-conditional-assertions": "off",
      "qunit/no-identical-names": "off",
      "qunit/no-loose-assertions": "off",
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
            "init",
            "willDestroy",
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
      "discourse/i18n-import-location": ["error"],
      "discourse/i18n-t": ["error"],
      "discourse/service-inject-import": ["error"],
      "discourse/no-simple-queryselector": ["error"],
      "discourse/deprecated-lookups": ["error"],
      "discourse/discourse-common-imports": ["error"],
    },
  },
  {
    files: ["**/*.gjs", "**/*.gts"],
    languageOptions: {
      parser: EmberESLintParser,
    },
  },
];
