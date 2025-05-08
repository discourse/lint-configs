import { strict as assert } from "node:assert";
import test from "node:test";
import stylelint from "stylelint";
import plugin from "../../lint-configs/stylelint-rules/no-breakpoint-mixin.js";

const ruleName = "discourse/no-breakpoint-mixin";

test(ruleName, async (t) => {
  const config = {
    plugins: [plugin],
    rules: { [ruleName]: true },
  };

  await t.test(
    "reports an error for invalid SCSS and autofixes it",
    async () => {
      const invalidSCSS = `
      @include breakpoint(mobile-small) {
        color: red;
      }
      @include breakpoint("tablet", min-width) {
        color: blue;
      }
    `;

      // Run without autofix to check for warnings
      const resultWithoutFix = await stylelint.lint({
        code: invalidSCSS,
        config,
        syntax: "scss",
      });

      assert.equal(resultWithoutFix.errored, true); // Should report an error
      assert.equal(resultWithoutFix.results[0].warnings.length, 2); // Two warnings expected
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

      assert.equal(resultWithFix.errored, false);
      assert.equal(resultWithFix.results[0].warnings.length, 0);
      assert.ok(resultWithFix.code.includes('@use "lib/viewport"'));
      assert.ok(resultWithFix.code.includes("@include viewport.until(sm)"));
      assert.ok(resultWithFix.code.includes("@include viewport.from(md)"));
    }
  );

  await t.test("does not report an error for valid SCSS", async () => {
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

  await t.test("adds @use 'lib/viewport' if missing", async () => {
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
