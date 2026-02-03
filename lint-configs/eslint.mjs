import BabelParser from "@babel/eslint-parser";
import js from "@eslint/js";
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
import capitalComponents from "./eslint-rules/capital-components.mjs";
import deprecatedImports from "./eslint-rules/deprecated-imports.mjs";
import deprecatedLookups from "./eslint-rules/deprecated-lookups.mjs";
import deprecatedPluginApis from "./eslint-rules/deprecated-plugin-apis.mjs";
import discourseCommonImports from "./eslint-rules/discourse-common-imports.mjs";
import i18nImport from "./eslint-rules/i18n-import-location.mjs";
import i18nT from "./eslint-rules/i18n-t.mjs";
import lineAfterImports from "./eslint-rules/line-after-imports.mjs";
import lineBeforeDefaultExport from "./eslint-rules/line-before-default-export.mjs";
import linesBetweenClassMembers from "./eslint-rules/lines-between-class-members.mjs";
import movedPackagesImportPaths from "./eslint-rules/moved-packages-import-paths.mjs";
import noCurlyComponents from "./eslint-rules/no-curly-components.mjs";
import noOnclick from "./eslint-rules/no-onclick.mjs";
import noRouteTemplate from "./eslint-rules/no-route-template.mjs";
import noSimpleQuerySelector from "./eslint-rules/no-simple-query-selector.mjs";
import noUnusedServices from "./eslint-rules/no-unused-services.mjs";
import pluginApiNoVersion from "./eslint-rules/plugin-api-no-version.mjs";
import serviceInjectImport from "./eslint-rules/service-inject-import.mjs";
import templateTagNoSelfThis from "./eslint-rules/template-tag-no-self-this.mjs";
import themeImports from "./eslint-rules/theme-imports.mjs";
import truthHelpersImports from "./eslint-rules/truth-helpers-imports.mjs";

let decoratorsPluginPath = import.meta
  .resolve("@babel/plugin-proposal-decorators")
  .replace(/^file:\/\//, "");

// Copied from "ember-template-imports/lib/utils"
const TEMPLATE_TAG_PLACEHOLDER = "__GLIMMER_TEMPLATE";

export default [
  js.configs.recommended,
  QUnitRecommended,
  ...EmberRecommended,
  {
    ignores: ["assets/vendor/**/*", "public/**/*"],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: BabelParser,
      parserOptions: {
        useBabel: true,
        requireConfigFile: false,
        babelOptions: {
          configFile: false,
          plugins: [[decoratorsPluginPath, { legacy: true }]],
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
          "truth-helpers-imports": truthHelpersImports,
          "no-unused-services": noUnusedServices,
          "plugin-api-no-version": pluginApiNoVersion,
          "theme-imports": themeImports,
          "no-simple-query-selector": noSimpleQuerySelector,
          "deprecated-lookups": deprecatedLookups,
          "discourse-common-imports": discourseCommonImports,
          "deprecated-imports": deprecatedImports,
          "lines-between-class-members": linesBetweenClassMembers,
          "deprecated-plugin-apis": deprecatedPluginApis,
          "line-after-imports": lineAfterImports,
          "line-before-default-export": lineBeforeDefaultExport,
          "no-curly-components": noCurlyComponents,
          "capital-components": capitalComponents,
          "no-onclick": noOnclick,
          "no-route-template": noRouteTemplate,
          "template-tag-no-self-this": templateTagNoSelfThis,
          "moved-packages-import-paths": movedPackagesImportPaths,
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
      "no-multi-str": "error",
      "no-new": "error",
      "no-proto": "error",
      "no-prototype-builtins": "off",
      "no-regex-spaces": "off",
      "no-script-url": "error",
      "no-sequences": "error",
      "no-shadow": "error",
      "no-this-before-super": "error",
      "no-undef": "error",
      "no-unexpected-multiline": "off",
      "no-unused-vars": "error",
      "no-useless-escape": "off",
      "no-var": "error",
      "no-with": "error",
      radix: "error",
      "valid-typeof": "error",
      curly: "error",
      "import/no-duplicates": "error",
      "object-shorthand": ["error", "properties"],
      "no-dupe-class-members": "error",
      "ember/no-component-lifecycle-hooks": "off", // too much noise for now; classic components should be converted to glimmer wholesale instead
      "ember/no-assignment-of-untracked-properties-used-in-tracking-contexts":
        "off", // TODO? needs to understand `@trackedArray` though
      "ember/no-computed-properties-in-native-classes": "off", // too many for now
      "ember/require-computed-property-dependencies": "off", // we no longer recommend using @computed
      "ember/require-return-from-computed": "off", // we no longer recommend using @computed
      "ember/use-brace-expansion": "off", // we no longer recommend using @computed
      "ember/no-deprecated-router-transition-methods": "off", // this rule is broken
      "ember/no-get": "off", // TODO: still too many uses, and is required when crossing `@tracked`/`EmberObject` boundary
      "ember/no-implicit-injections": "off", // this rule is broken
      "ember/no-array-prototype-extensions": "off", // too many false-positives
      "ember/no-at-ember-render-modifiers": "off", // TODO: @ember/render-modifiers are considered an anti-pattern
      "ember/classic-decorator-hooks": "off", // too much noise; doesn't consider EmberObject/Controller/EmberComponent as classic w/o the decorator
      "ember/classic-decorator-no-classic-methods": "off", // same as ember/classic-decorator-hooks
      "ember/no-runloop": "off", // TODO: though not in the foreseeable future
      "ember/no-capital-letters-in-routes": "off", // TODO: too many errors for now
      "ember/no-controller-access-in-routes": "off", // TODO: maybe?
      "ember/no-shadow-route-definition": "off", // TODO: but there seems to be a bug in the rule (a nested route can't shadow the parent)
      "ember/no-unnecessary-index-route": "off", // the assumption made in this rule doesn't seem to be true in discourse router
      "ember/no-unnecessary-service-injection-argument": "error",
      "ember/no-replace-test-comments": "error",
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
      "discourse/truth-helpers-imports": ["error"],
      "discourse/no-unused-services": ["error"],
      "discourse/plugin-api-no-version": ["error"],
      "discourse/theme-imports": ["error"],
      "discourse/no-simple-query-selector": ["error"],
      "discourse/deprecated-lookups": ["error"],
      "discourse/discourse-common-imports": ["error"],
      "discourse/deprecated-imports": ["error"],
      "discourse/lines-between-class-members": ["error"],
      "discourse/deprecated-plugin-apis": ["error"],
      "discourse/line-after-imports": ["error"],
      "discourse/line-before-default-export": ["error"],
      "discourse/no-curly-components": ["error"],
      "discourse/capital-components": ["error"],
      "discourse/no-onclick": ["error"],
      "discourse/template-tag-no-self-this": ["error"],
      "discourse/no-route-template": ["error"],
      "discourse/moved-packages-import-paths": ["error"],
    },
  },
  {
    files: ["**/*.gjs", "**/*.gts"],
    languageOptions: {
      parser: EmberESLintParser,
    },
  },
];
