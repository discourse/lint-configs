export default {
  output: {
    format: "cjs",
  },
  external: [
    "@babel/eslint-parser",
    "eslint-plugin-ember",
    "eslint-plugin-discourse-ember",
    "eslint-plugin-sort-class-members",
    "eslint-plugin-decorator-position",
    "eslint-plugin-simple-import-sort",
    // prettier-custom-babel-plugin deps
    "@babel/parser",
    "@babel/types",
    "@typescript-eslint/visitor-keys",
    "hermes-parser/dist/generated/ESTreeVisitorKeys.js",
    "prettier/plugins/babel",
    "to-fast-properties",
  ],
};
