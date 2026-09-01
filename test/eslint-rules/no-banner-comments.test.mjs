import EmberESLintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-banner-comments.mjs";

const ruleTester = new RuleTester({
  languageOptions: { parser: EmberESLintParser },
});

ruleTester.run("no-banner-comments", rule, {
  valid: [
    {
      code: `
        // A normal note
        const a = 1;

        /* Section name */
        const b = 2;

        /**
         * A doc block with a table row: | a | b |
         * and a dashed range 1--2 and an arrow -->.
         */
        const c = 3;

        const d = "----- inside a string -----";

        // TODO ------ not a divider, it has text before the run
        const e = 4;

        // For a 100MB file with 20 chunks:
        //
        // Total 20 chunks
        // ---------
        // Need 1 is 10
        // Need 2 is 5
        const f = 5;
      `,
    },
    {
      code: `
        /**
         * | column | value |
         * |--------|-------|
         * | a      | b     |
         *
         * Heading
         * -----------------------
         */
        const a = 1;

        /*
          A------B
          |      |
          -------
        */
        const b = 2;
      `,
    },
    {
      code: `
        <template>
          {{! a template comment }}
          <div></div>
        </template>
      `,
    },
  ],
  invalid: [
    {
      code: `
        // ---------
        const a = 1;
      `,
      errors: [{ messageId: "banner" }],
    },
    {
      code: `
        // ===== Helpers =====
        const a = 1;
      `,
      errors: [{ messageId: "banner" }],
    },
    {
      code: `
        /* ***** Section ***** */
        const a = 1;
      `,
      errors: [{ messageId: "banner" }],
    },
    {
      code: `
        /*
         * ##### Section #####
         */
        const a = 1;
      `,
      errors: [{ messageId: "banner" }],
    },
    {
      code: `
        // ~~~~ Section ~~~~
        // ____ Another ____
        const a = 1;
      `,
      errors: [{ messageId: "banner" }],
    },
    {
      code: `
        // ----------------------
        // Public API
        // ----------------------
        const a = 1;

        // ======
        const b = 2;
      `,
      errors: [{ messageId: "banner" }, { messageId: "banner" }],
    },
  ],
});
