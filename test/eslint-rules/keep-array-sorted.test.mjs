import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/keep-array-sorted.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("keep-array-sorted", rule, {
  valid: [
    {
      code: "/* eslint-discourse keep-array-sorted */ const a = ['a', 'b', 'c'];",
    },
    {
      code: `// eslint-discourse keep-array-sorted
const a = ['a', 'b', 'c'];`,
    },
    {
      code: "const a = ['b', 'a'];",
    },
    {
      code: "/* eslint-discourse keep-array-sorted */ const a = [1, 2, 3];",
    },
    {
      code: `
        /* eslint-discourse keep-array-sorted */
        const a = [
            'a',
            'b',
            'c'
        ];
        `,
    },
  ],
  invalid: [
    {
      code: "/* eslint-discourse keep-array-sorted */ const a = ['b', 'a'];",
      output: "/* eslint-discourse keep-array-sorted */ const a = ['a', 'b'];",
      errors: [{ message: "Array should be sorted." }],
    },
    {
      code: `// eslint-discourse keep-array-sorted
const a = ['b', 'a'];`,
      output: `// eslint-discourse keep-array-sorted
const a = ['a', 'b'];`,
      errors: [{ message: "Array should be sorted." }],
    },
    {
      code: "/* eslint-discourse keep-array-sorted */ const a = [2, 1, 3];",
      output: "/* eslint-discourse keep-array-sorted */ const a = [1, 2, 3];",
      errors: [{ message: "Array should be sorted." }],
    },
    {
      code: `
        /* eslint-discourse keep-array-sorted */
        const a = [
            'c',
            'a',
            'b'
        ];
        `,
      output: `
        /* eslint-discourse keep-array-sorted */
        const a = [
            'a',
            'b',
            'c'
        ];
        `,
      errors: [{ message: "Array should be sorted." }],
    },
    {
      code: `
        /* eslint-discourse keep-array-sorted */
        const a = [
            'b', // comment b
            'a' // comment a
        ];
        `,
      output: `
        /* eslint-discourse keep-array-sorted */
        const a = [
            'a', // comment a
            'b' // comment b
        ];
        `,
      errors: [{ message: "Array should be sorted." }],
    },
    {
      code: `
// eslint-discourse keep-array-sorted
export const VALUE_TRANSFORMERS = Object.freeze([
  "composer-reply-options-user-link-name",
  "composer-reply-options-user-avatar-template",
]);
      `,
      output: `
// eslint-discourse keep-array-sorted
export const VALUE_TRANSFORMERS = Object.freeze([
  "composer-reply-options-user-avatar-template",
  "composer-reply-options-user-link-name",
]);
      `,
      errors: [{ message: "Array should be sorted." }],
    },
    {
      code: `
// eslint-discourse keep-array-sorted
export const NO_TRAILING = [
  "b",
  "a"
];
      `,
      output: `
// eslint-discourse keep-array-sorted
export const NO_TRAILING = [
  "a",
  "b"
];
      `,
      errors: [{ message: "Array should be sorted." }],
    },
    {
      code: `// eslint-discourse keep-array-sorted
export const SHORT = ["b", "a"];`,
      output: `// eslint-discourse keep-array-sorted
export const SHORT = ["a", "b"];`,
      errors: [{ message: "Array should be sorted." }],
    },
    {
      code: `
export const VALUE_TRANSFORMERS = Object.freeze(
  // eslint-discourse keep-array-sorted
  [
    "b",
    "a"
  ]
);
      `,
      output: `
export const VALUE_TRANSFORMERS = Object.freeze(
  // eslint-discourse keep-array-sorted
  [
    "a",
    "b"
  ]
);
      `,
      errors: [{ message: "Array should be sorted." }],
    },
    {
      code: `
// eslint-discourse keep-array-sorted
export const WITH_INTERNAL_COMMENT = [
  // comment
  "b",
  "a"
];
      `,
      output: `
// eslint-discourse keep-array-sorted
export const WITH_INTERNAL_COMMENT = [
  "a",
  // comment
  "b"
];
      `,
      errors: [{ message: "Array should be sorted." }],
    },
  ],
});
