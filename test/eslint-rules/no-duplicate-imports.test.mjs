import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-duplicate-imports.mjs";

const ruleTester = new RuleTester();

ruleTester.run("no-duplicate-imports", rule, {
  valid: [
    // A single import per module is fine.
    { code: 'import { a, b } from "foo";' },
    // Different modules are not duplicates.
    { code: 'import { a } from "foo";\nimport { b } from "bar";' },
    // Default + named in one statement is fine.
    { code: 'import foo, { a } from "foo";' },
    // A namespace import can't be combined with named imports, so it's allowed.
    { code: 'import * as foo from "foo";\nimport { a } from "foo";' },
  ],
  invalid: [
    // Two named imports merge into one.
    {
      code: 'import { a } from "foo";\nimport { b } from "foo";',
      errors: [{ messageId: "duplicate" }],
      output: 'import { a, b } from "foo";\n',
    },
    // Default and named imports merge, keeping the default first.
    {
      code: 'import foo from "foo";\nimport { a } from "foo";',
      errors: [{ messageId: "duplicate" }],
      output: 'import foo, { a } from "foo";\n',
    },
    // Aliases are preserved when merging.
    {
      code: 'import { a as b } from "foo";\nimport { c } from "foo";',
      errors: [{ messageId: "duplicate" }],
      output: 'import { a as b, c } from "foo";\n',
    },
    // A module imported three times reports two duplicates and collapses.
    {
      code: 'import { a } from "foo";\nimport { b } from "foo";\nimport { c } from "foo";',
      errors: [{ messageId: "duplicate" }, { messageId: "duplicate" }],
      output: 'import { a, b, c } from "foo";\n',
    },
    // Side-effect-only duplicates collapse to a single import.
    {
      code: 'import "foo";\nimport "foo";',
      errors: [{ messageId: "duplicate" }],
      output: 'import "foo";\n',
    },
    // A side-effect import merges into a named import of the same module.
    {
      code: 'import "foo";\nimport { a } from "foo";',
      errors: [{ messageId: "duplicate" }],
      output: 'import { a } from "foo";\n',
    },
    // Mergeable named imports collapse even when a namespace import sits
    // between them; the namespace import is left untouched.
    {
      code: 'import { a } from "foo";\nimport * as ns from "foo";\nimport { b } from "foo";',
      errors: [{ messageId: "duplicate" }],
      output: 'import { a, b } from "foo";\nimport * as ns from "foo";\n',
    },
    // Conflicting default names are flagged but can't be auto-fixed.
    {
      code: 'import foo from "foo";\nimport bar from "foo";',
      errors: [{ messageId: "duplicateManual" }],
      output: null,
    },
  ],
});
