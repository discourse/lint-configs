const templateTagPluginPath =
  require.resolve("prettier-plugin-ember-template-tag");

module.exports = {
  plugins: [templateTagPluginPath],
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
