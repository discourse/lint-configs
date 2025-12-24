import EmberESLintParser from "ember-eslint-parser";
import { Linter } from "eslint";
import { describe, it } from "mocha";
import assert from "node:assert";
import { analyzeDiscourseComputedUsage } from "../../lint-configs/eslint-rules/no-discourse-computed/discourse-computed-analysis.mjs";

describe("analyzeDiscourseComputedUsage", () => {
  function getAnalysis(code, localName = "discourseComputed") {
    let sourceCode;
    const linter = new Linter({ configType: "flat" });
    linter.verify(
      code,
      [
        {
          languageOptions: {
            parser: EmberESLintParser,
            parserOptions: {
              ecmaVersion: 2022,
              sourceType: "module",
              ecmaFeatures: { legacyDecorators: true },
            },
          },
          plugins: {
            test: {
              rules: {
                "get-source": {
                  create(context) {
                    sourceCode = context.sourceCode;
                    return {};
                  },
                },
              },
            },
          },
          rules: {
            "test/get-source": "error",
          },
        },
      ],
      { filename: "test.js" }
    );

    if (!sourceCode) {
      throw new Error("Failed to capture sourceCode");
    }

    return analyzeDiscourseComputedUsage(sourceCode, localName);
  }

  it("identifies fixable decorators", () => {
    const code = `
      class MyClass {
        @discourseComputed("foo")
        bar(foo) { return foo; }
      }
    `;
    const info = getAnalysis(code);
    assert.strictEqual(info.hasFixableDecorators, true);
    assert.strictEqual(info.hasParameterReassignments, false);
  });

  it("identifies parameter reassignment", () => {
    const code = `
      class MyClass {
        @discourseComputed("foo")
        bar(foo) {
          if (true) { foo = 1; }
          return foo;
        }
      }
    `;
    const info = getAnalysis(code);
    assert.strictEqual(info.hasParameterReassignments, true);
    assert.strictEqual(info.hasFixableDecorators, false);
  });

  it("identifies spread usage", () => {
    const code = `
      class MyClass {
        @discourseComputed("foo")
        bar(foo) {
          return [...foo];
        }
      }
    `;
    const info = getAnalysis(code);
    assert.strictEqual(info.hasParametersInSpread, true);
  });

  it("identifies nested function usage", () => {
    const code = `
      class MyClass {
        @discourseComputed("foo")
        bar(foo) {
          return function() { return foo; };
        }
      }
    `;
    const info = getAnalysis(code);
    assert.strictEqual(info.hasParameterInNestedFunction, true);
  });

  it("identifies unsafe optional chaining", () => {
    const code = `
      class MyClass {
        @discourseComputed("model.foo", "model.bar")
        bar(foo, bar) {
          return (foo || bar).toLowerCase();
        }
      }
    `;
    const info = getAnalysis(code);
    assert.strictEqual(info.hasUnsafeOptionalChaining, true);
  });

  it("correctly handles classic Ember classes with direct calls", () => {
    const code = `
      import Component from "@ember/component";
      const MyComponent = Component.extend({
        bar: discourseComputed("foo", function(foo) { return foo; })
      });
    `;
    const info = getAnalysis(code);
    assert.strictEqual(info.hasClassicClassDecorators, true);
  });

  it("identifies guard clause reassignment as fixable", () => {
    const code = `
      class MyClass {
        @discourseComputed("foo")
        bar(foo) {
          if (!foo) { foo = []; }
          return foo.length;
        }
      }
    `;
    const info = getAnalysis(code);
    assert.strictEqual(info.hasParameterReassignments, false);
    assert.strictEqual(info.hasFixableDecorators, true);
  });
});
