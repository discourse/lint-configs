import customBabelPlugin from "./prettier-custom-babel-plugin.js";

export default {
  plugins: [customBabelPlugin, "prettier-plugin-ember-template-tag"],
  parser: "custom-babel-parser",
  overrides: [
    {
      files: "*.gjs",
      options: {
        parser: "ember-template-tag",
      },
    },
    {
      files: "*.gts",
      options: {
        parser: "ember-template-tag",
      },
    },
  ],
};
