/* global describe, it */

import { strict as assert } from "node:assert";
import stylelint from "stylelint";
import plugin from "../../lint-configs/stylelint-rules/no-global-breakpoint-mixin.js";

const ruleName = "discourse/no-global-breakpoint-mixin";

describe(ruleName, () => {
  const config = {
    plugins: [plugin],
    rules: { [ruleName]: true },
  };

  it("reports an error for invalid SCSS and autofixes it", async () => {
    const invalidSCSS = `
      @include breakpoint(mobile-small) {
        color: red;
      }
    `;

    // Run without autofix to check for warnings
    const resultWithoutFix = await stylelint.lint({
      code: invalidSCSS,
      config,
      syntax: "scss",
    });

    assert.equal(resultWithoutFix.errored, true); // Should report an error
    assert.equal(resultWithoutFix.results[0].warnings.length, 1); // One warning expected
    assert.ok(
      resultWithoutFix.results[0].warnings[0].text.includes(
        'Replace "@include breakpoint(...)" with "@include viewport.until(...)"'
      )
    );

    // Run with autofix to check the output
    const resultWithFix = await stylelint.lint({
      code: invalidSCSS,
      config,
      fix: true,
      syntax: "scss",
    });

    assert.equal(resultWithFix.errored, false); // No errors after autofix
    assert.equal(resultWithFix.results[0].warnings.length, 0); // No warnings after autofix
    assert.ok(resultWithFix.code.includes('@use "lib/viewport"')); // Ensure @use is added
    assert.ok(resultWithFix.code.includes("@include viewport.until(sm)")); // Ensure mixin is updated
  });

  it("does not report an error for valid SCSS", async () => {
    const validSCSS = `
      @use "lib/viewport";
      @include viewport.until(sm) {
        color: red;
      }
    `;

    const result = await stylelint.lint({
      code: validSCSS,
      config,
      syntax: "scss",
    });

    assert.equal(result.errored, false); // No errors for valid SCSS
    assert.equal(result.results[0].warnings.length, 0); // No warnings for valid SCSS
  });

  it("adds @use 'lib/viewport' if missing", async () => {
    const invalidSCSS = `
      @include breakpoint("tablet") {
        color: blue;
      }
    `.trim();

    // Run with autofix to check the output
    const resultWithFix = await stylelint.lint({
      code: invalidSCSS,
      config,
      fix: true,
      syntax: "scss",
    });

    assert.equal(resultWithFix.errored, false); // No errors after autofix
    assert.equal(resultWithFix.results[0].warnings.length, 0); // No warnings after autofix
    assert.ok(resultWithFix.code.includes('@use "lib/viewport"')); // Ensure @use is added
    assert.ok(resultWithFix.code.includes("@include viewport.until(md)")); // Ensure mixin is updated
  });
});
