module.exports = {
  plugins: ["prettier-plugin-ember-template-tag"],
  trailingComma: "es5",
  overrides: [
    {
      files: "*.gjs",
      options: {
        parser: "ember-template-tag",
        templateExportDefault: true,
      },
    },
    {
      files: "*.gts",
      options: {
        parser: "ember-template-tag",
        templateExportDefault: true,
      },
    },
  ],
};
