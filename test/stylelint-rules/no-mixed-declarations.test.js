import test from "node:test";
import stylelint from "stylelint";
import plugin from "../../lint-configs/stylelint-rules/no-mixed-declarations.js";
import { strict as assert } from "assert";

const ruleName = "discourse/no-mixed-declarations";

const config = {
  plugins: [plugin],
  rules: { [ruleName]: true },
};

test(ruleName, async (t) => {
  await t.test(
    "should report an error for mixed declarations and nested rules",
    async () => {
      const invalidSCSS = `
      .example {
        color: red;
        .nested {
          color: blue;
        }
        background: yellow;
      }
    `;

      const fixedSCSS = `
      .example {
        color: red;
        background: yellow;
        .nested {
          color: blue;
        }
      }
    `;

      const resultWithoutFix = await stylelint.lint({
        code: invalidSCSS,
        config,
        syntax: "scss",
      });

      assert.equal(resultWithoutFix.errored, true);
      assert.equal(resultWithoutFix.results[0].warnings.length, 1);
      assert.ok(
        resultWithoutFix.results[0].warnings[0].text.includes(
          "Do not mix declarations with nested rules or directives."
        )
      );

      const resultWithFix = await stylelint.lint({
        code: invalidSCSS,
        config,
        fix: true,
        syntax: "scss",
      });

      assert.equal(resultWithFix.errored, false);
      assert.equal(resultWithFix.results[0].warnings.length, 0);
      assert.equal(resultWithFix.output.trim(), fixedSCSS.trim());
    }
  );

  await t.test(
    "should not report an error for properly ordered declarations",
    async () => {
      const validSCSS = `
      .example {
        color: red;
        background: yellow;
        .nested {
          color: blue;
        }
      }
    `;

      const result = await stylelint.lint({
        code: validSCSS,
        config,
        syntax: "scss",
      });

      assert.equal(result.errored, false);
      assert.equal(result.results[0].warnings.length, 0);
    }
  );

  await t.test("should not report an error for only nested rules", async () => {
    const validSCSS = `
      .example {
        .nested {
          color: blue;
        }
        .another-nested {
          background: yellow;
        }
      }
    `;

    const result = await stylelint.lint({
      code: validSCSS,
      config,
      syntax: "scss",
    });

    assert.equal(result.errored, false);
    assert.equal(result.results[0].warnings.length, 0);
  });

  await t.test("should not report an error for only declarations", async () => {
    const validSCSS = `
      .example {
        color: red;
        background: yellow;
      }
    `;

    const result = await stylelint.lint({
      code: validSCSS,
      config,
      syntax: "scss",
    });

    assert.equal(result.errored, false);
    assert.equal(result.results[0].warnings.length, 0);
  });

  await t.test(
    "should report an error for mixed declarations and @include statements",
    async () => {
      const invalidSCSS = `
      .example {
        color: red;
        @include some-mixin;
        background: yellow;
      }
    `;

      const fixedSCSS = `
      .example {
        color: red;
        background: yellow;
        @include some-mixin;
      }
    `;

      const resultWithoutFix = await stylelint.lint({
        code: invalidSCSS,
        config,
        syntax: "scss",
      });

      assert.equal(resultWithoutFix.errored, true);
      assert.equal(resultWithoutFix.results[0].warnings.length, 1);
      assert.ok(
        resultWithoutFix.results[0].warnings[0].text.includes(
          "Do not mix declarations with nested rules or directives."
        )
      );

      const resultWithFix = await stylelint.lint({
        code: invalidSCSS,
        config,
        fix: true,
        syntax: "scss",
      });

      assert.equal(resultWithFix.errored, false);
      assert.equal(resultWithFix.results[0].warnings.length, 0);
      assert.equal(resultWithFix.output.trim(), fixedSCSS.trim());
    }
  );
});
