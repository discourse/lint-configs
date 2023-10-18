import customBabelPlugin from "./prettier-custom-babel-plugin.js";

export default {
  plugins: [customBabelPlugin, "prettier-plugin-ember-template-tag"],
  overrides: [
    {
      files: ["*.js"],
      options: {
        parser: "custom-babel-parser",
      },
    },
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
