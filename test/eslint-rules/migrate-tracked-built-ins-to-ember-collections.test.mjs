import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/migrate-tracked-built-ins-to-ember-collections.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

function importMessage(
  specifiers,
  oldSource = "@ember-compat/tracked-built-ins"
) {
  // specifiers: [{ old, new, local? }]
  const oldList = specifiers.map((s) => `'${s.old}'`).join(", ");
  const newList = specifiers.map((s) => `'${s.new}'`).join(", ");

  const usageNotes = specifiers
    .map((s) => {
      const callName = s.local && s.local !== s.old ? s.local : s.new;
      return `${callName}() instead of new ${s.local || s.old}()`;
    })
    .join(", ");

  return (
    `Use ${newList} from '@ember/reactive/collections' instead of ${oldList} from '${oldSource}'.` +
    ` Note: use ${usageNotes}.`
  );
}

function namingConflictMessage(oldName, newName) {
  return (
    `Use \`${newName}\` from '@ember/reactive/collections' instead of \`${oldName}\`:` +
    ` \`${newName}\` conflicts with an existing binding. Rename the conflicting identifier first.`
  );
}

function nonNewMessage(oldName, newName) {
  return (
    `'${oldName}' must be migrated to '@ember/reactive/collections', but this usage requires manual review.` +
    ` The new module exports '${newName}' as a factory function, not a class,` +
    ` so 'instanceof', class references, etc. will not work the same way.`
  );
}

ruleTester.run("migrate-tracked-built-ins-to-ember-collections", rule, {
  valid: [
    // Already migrated
    `import { trackedArray } from "@ember/reactive/collections";`,

    // Different package
    `import { TrackedArray } from "some-other-package";`,

    // Unrelated import
    `import { something } from "@ember-compat/tracked-built-ins";`,

    // Unrelated import from 'tracked-built-ins'
    `import { something } from "tracked-built-ins";`,
  ],
  invalid: [
    // `tracked` import — likely confused with @glimmer/tracking
    {
      code: `import { tracked } from "@ember-compat/tracked-built-ins";`,
      errors: [
        {
          message:
            "'tracked' should not be imported from '@ember-compat/tracked-built-ins'." +
            " Use '@glimmer/tracking' for the @tracked decorator," +
            " or use the specific factory functions from '@ember/reactive/collections'" +
            " (e.g. trackedArray(), trackedMap(), trackedObject()).",
        },
      ],
      output: null,
    },

    // `tracked` alongside a fixable specifier
    {
      code: `import { tracked, TrackedSet } from "@ember-compat/tracked-built-ins";\nconst set = new TrackedSet();`,
      errors: [
        {
          message: importMessage([{ old: "TrackedSet", new: "trackedSet" }]),
        },
        {
          message:
            "'tracked' should not be imported from '@ember-compat/tracked-built-ins'." +
            " Use '@glimmer/tracking' for the @tracked decorator," +
            " or use the specific factory functions from '@ember/reactive/collections'" +
            " (e.g. trackedArray(), trackedMap(), trackedObject()).",
        },
      ],
      output: `import { tracked } from "@ember-compat/tracked-built-ins";\nimport { trackedSet } from "@ember/reactive/collections";\nconst set = trackedSet();`,
    },

    // Single specifier with new usage
    {
      code: `import { TrackedArray } from "@ember-compat/tracked-built-ins";\nconst arr = new TrackedArray([1, 2, 3]);`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
          ]),
        },
      ],
      output: `import { trackedArray } from "@ember/reactive/collections";\nconst arr = trackedArray([1, 2, 3]);`,
    },

    // TrackedObject
    {
      code: `import { TrackedObject } from "@ember-compat/tracked-built-ins";\nconst obj = new TrackedObject({ key: "value" });`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedObject", new: "trackedObject" },
          ]),
        },
      ],
      output: `import { trackedObject } from "@ember/reactive/collections";\nconst obj = trackedObject({ key: "value" });`,
    },

    // TrackedMap
    {
      code: `import { TrackedMap } from "@ember-compat/tracked-built-ins";\nconst map = new TrackedMap();`,
      errors: [
        {
          message: importMessage([{ old: "TrackedMap", new: "trackedMap" }]),
        },
      ],
      output: `import { trackedMap } from "@ember/reactive/collections";\nconst map = trackedMap();`,
    },

    // TrackedSet
    {
      code: `import { TrackedSet } from "@ember-compat/tracked-built-ins";\nconst set = new TrackedSet([1, 2]);`,
      errors: [
        {
          message: importMessage([{ old: "TrackedSet", new: "trackedSet" }]),
        },
      ],
      output: `import { trackedSet } from "@ember/reactive/collections";\nconst set = trackedSet([1, 2]);`,
    },

    // TrackedWeakMap
    {
      code: `import { TrackedWeakMap } from "@ember-compat/tracked-built-ins";\nconst map = new TrackedWeakMap();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedWeakMap", new: "trackedWeakMap" },
          ]),
        },
      ],
      output: `import { trackedWeakMap } from "@ember/reactive/collections";\nconst map = trackedWeakMap();`,
    },

    // TrackedWeakSet
    {
      code: `import { TrackedWeakSet } from "@ember-compat/tracked-built-ins";\nconst set = new TrackedWeakSet();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedWeakSet", new: "trackedWeakSet" },
          ]),
        },
      ],
      output: `import { trackedWeakSet } from "@ember/reactive/collections";\nconst set = trackedWeakSet();`,
    },

    // Multiple specifiers
    {
      code: `import { TrackedArray, TrackedMap } from "@ember-compat/tracked-built-ins";\nconst arr = new TrackedArray();\nconst map = new TrackedMap();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
            { old: "TrackedMap", new: "trackedMap" },
          ]),
        },
      ],
      output: `import { trackedArray, trackedMap } from "@ember/reactive/collections";\nconst arr = trackedArray();\nconst map = trackedMap();`,
    },

    // Aliased import (alias preserved, new removed)
    {
      code: `import { TrackedArray as TA } from "@ember-compat/tracked-built-ins";\nconst arr = new TA();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray", local: "TA" },
          ]),
        },
      ],
      output: `import { trackedArray as TA } from "@ember/reactive/collections";\nconst arr = TA();`,
    },

    // Multiple usages of same import
    {
      code: `import { TrackedArray } from "@ember-compat/tracked-built-ins";\nconst a = new TrackedArray();\nconst b = new TrackedArray([1]);`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
          ]),
        },
      ],
      output: `import { trackedArray } from "@ember/reactive/collections";\nconst a = trackedArray();\nconst b = trackedArray([1]);`,
    },

    // Class property initializer
    {
      code: `import { TrackedArray } from "@ember-compat/tracked-built-ins";\nclass MyComponent {\n  items = new TrackedArray();\n}`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
          ]),
        },
      ],
      output: `import { trackedArray } from "@ember/reactive/collections";\nclass MyComponent {\n  items = trackedArray();\n}`,
    },

    // Mixed aliased and non-aliased
    {
      code: `import { TrackedArray, TrackedMap as TM } from "@ember-compat/tracked-built-ins";\nconst arr = new TrackedArray();\nconst map = new TM();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
            { old: "TrackedMap", new: "trackedMap", local: "TM" },
          ]),
        },
      ],
      output: `import { trackedArray, trackedMap as TM } from "@ember/reactive/collections";\nconst arr = trackedArray();\nconst map = TM();`,
    },

    // Non-new usage: no auto-fix (instanceof) - reports on import + on the reference
    {
      code: `import { TrackedArray } from "@ember-compat/tracked-built-ins";\nconst isTracked = arr instanceof TrackedArray;`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
          ]),
        },
        {
          message: nonNewMessage("TrackedArray", "trackedArray"),
        },
      ],
      output: null,
    },

    // Non-new usage: no auto-fix (class ref) - reports on import + on the reference
    {
      code: `import { TrackedArray } from "@ember-compat/tracked-built-ins";\nconst factory = TrackedArray;`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
          ]),
        },
        {
          message: nonNewMessage("TrackedArray", "trackedArray"),
        },
      ],
      output: null,
    },

    // Mixed new and non-new usage: no auto-fix, reports import + non-new ref
    {
      code: `import { TrackedArray } from "@ember-compat/tracked-built-ins";\nconst arr = new TrackedArray();\nconst isTracked = arr instanceof TrackedArray;`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
          ]),
        },
        {
          message: nonNewMessage("TrackedArray", "trackedArray"),
        },
      ],
      output: null,
    },

    // Import-only (no usage): should still auto-fix
    {
      code: `import { TrackedArray } from "@ember-compat/tracked-built-ins";`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
          ]),
        },
      ],
      output: `import { trackedArray } from "@ember/reactive/collections";`,
    },

    // Partial fix: TrackedArray has instanceof but TrackedSet is all new
    {
      code: `import { TrackedArray, TrackedSet } from "@ember-compat/tracked-built-ins";\nconst arr = new TrackedArray();\nconst isTracked = arr instanceof TrackedArray;\nconst set = new TrackedSet();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
            { old: "TrackedSet", new: "trackedSet" },
          ]),
        },
        {
          message: nonNewMessage("TrackedArray", "trackedArray"),
        },
      ],
      output: `import { TrackedArray } from "@ember-compat/tracked-built-ins";\nimport { trackedSet } from "@ember/reactive/collections";\nconst arr = new TrackedArray();\nconst isTracked = arr instanceof TrackedArray;\nconst set = trackedSet();`,
    },

    // Partial fix with alias: TrackedArray unfixable, TrackedMap as TM fixable
    {
      code: `import { TrackedArray, TrackedMap as TM } from "@ember-compat/tracked-built-ins";\nconst factory = TrackedArray;\nconst map = new TM();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
            { old: "TrackedMap", new: "trackedMap", local: "TM" },
          ]),
        },
        {
          message: nonNewMessage("TrackedArray", "trackedArray"),
        },
      ],
      output: `import { TrackedArray } from "@ember-compat/tracked-built-ins";\nimport { trackedMap as TM } from "@ember/reactive/collections";\nconst factory = TrackedArray;\nconst map = TM();`,
    },

    // --- 'tracked-built-ins' source (without @ember-compat/ prefix) ---

    // Single specifier from 'tracked-built-ins'
    {
      code: `import { TrackedArray } from "tracked-built-ins";\nconst arr = new TrackedArray([1, 2, 3]);`,
      errors: [
        {
          message: importMessage(
            [{ old: "TrackedArray", new: "trackedArray" }],
            "tracked-built-ins"
          ),
        },
      ],
      output: `import { trackedArray } from "@ember/reactive/collections";\nconst arr = trackedArray([1, 2, 3]);`,
    },

    // Multiple specifiers from 'tracked-built-ins'
    {
      code: `import { TrackedArray, TrackedSet } from "tracked-built-ins";\nconst arr = new TrackedArray();\nconst set = new TrackedSet();`,
      errors: [
        {
          message: importMessage(
            [
              { old: "TrackedArray", new: "trackedArray" },
              { old: "TrackedSet", new: "trackedSet" },
            ],
            "tracked-built-ins"
          ),
        },
      ],
      output: `import { trackedArray, trackedSet } from "@ember/reactive/collections";\nconst arr = trackedArray();\nconst set = trackedSet();`,
    },

    // `tracked` import from 'tracked-built-ins'
    {
      code: `import { tracked } from "tracked-built-ins";`,
      errors: [
        {
          message:
            "'tracked' should not be imported from 'tracked-built-ins'." +
            " Use '@glimmer/tracking' for the @tracked decorator," +
            " or use the specific factory functions from '@ember/reactive/collections'" +
            " (e.g. trackedArray(), trackedMap(), trackedObject()).",
        },
      ],
      output: null,
    },

    // Non-new usage from 'tracked-built-ins': no auto-fix
    {
      code: `import { TrackedArray } from "tracked-built-ins";\nconst isTracked = arr instanceof TrackedArray;`,
      errors: [
        {
          message: importMessage(
            [{ old: "TrackedArray", new: "trackedArray" }],
            "tracked-built-ins"
          ),
        },
        {
          message: nonNewMessage("TrackedArray", "trackedArray"),
        },
      ],
      output: null,
    },

    // Partial fix from 'tracked-built-ins': TrackedArray unfixable, TrackedSet fixable
    {
      code: `import { TrackedArray, TrackedSet } from "tracked-built-ins";\nconst arr = new TrackedArray();\nconst isTracked = arr instanceof TrackedArray;\nconst set = new TrackedSet();`,
      errors: [
        {
          message: importMessage(
            [
              { old: "TrackedArray", new: "trackedArray" },
              { old: "TrackedSet", new: "trackedSet" },
            ],
            "tracked-built-ins"
          ),
        },
        {
          message: nonNewMessage("TrackedArray", "trackedArray"),
        },
      ],
      output: `import { TrackedArray } from "tracked-built-ins";\nimport { trackedSet } from "@ember/reactive/collections";\nconst arr = new TrackedArray();\nconst isTracked = arr instanceof TrackedArray;\nconst set = trackedSet();`,
    },

    // --- Duplicate import prevention ---

    // Existing import from new source: merge specifiers
    {
      code: `import { trackedMap } from "@ember/reactive/collections";\nimport { TrackedArray } from "@ember-compat/tracked-built-ins";\nconst arr = new TrackedArray();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
          ]),
        },
      ],
      output: `import { trackedMap, trackedArray } from "@ember/reactive/collections";\n\nconst arr = trackedArray();`,
    },

    // Existing import from new source with alias: reuse alias at usage sites
    {
      code: `import { trackedArray as ta } from "@ember/reactive/collections";\nimport { TrackedArray } from "@ember-compat/tracked-built-ins";\nconst arr = new TrackedArray();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
          ]),
        },
      ],
      output: `import { trackedArray as ta } from "@ember/reactive/collections";\n\nconst arr = ta();`,
    },

    // --- Naming conflict prevention ---

    // Naming conflict: no autofix when new name conflicts with existing binding
    {
      code: `import { TrackedArray } from "@ember-compat/tracked-built-ins";\nconst trackedArray = [1, 2, 3];\nconst arr = new TrackedArray();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
          ]),
        },
        {
          message: namingConflictMessage("TrackedArray", "trackedArray"),
        },
      ],
      output: null,
    },

    // Partial naming conflict: TrackedArray conflicts, TrackedSet doesn't
    {
      code: `import { TrackedArray, TrackedSet } from "@ember-compat/tracked-built-ins";\nconst trackedArray = [1, 2, 3];\nconst arr = new TrackedArray();\nconst set = new TrackedSet();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray" },
            { old: "TrackedSet", new: "trackedSet" },
          ]),
        },
        {
          message: namingConflictMessage("TrackedArray", "trackedArray"),
        },
      ],
      output: `import { TrackedArray } from "@ember-compat/tracked-built-ins";\nimport { trackedSet } from "@ember/reactive/collections";\nconst trackedArray = [1, 2, 3];\nconst arr = new TrackedArray();\nconst set = trackedSet();`,
    },

    // Aliased import avoids naming conflict (alias preserved, no conflict)
    {
      code: `import { TrackedArray as TA } from "@ember-compat/tracked-built-ins";\nconst trackedArray = [1, 2, 3];\nconst arr = new TA();`,
      errors: [
        {
          message: importMessage([
            { old: "TrackedArray", new: "trackedArray", local: "TA" },
          ]),
        },
      ],
      output: `import { trackedArray as TA } from "@ember/reactive/collections";\nconst trackedArray = [1, 2, 3];\nconst arr = TA();`,
    },
  ],
});
