const prettierPluginEmberTemplateTag = require("prettier-plugin-ember-template-tag");

module.exports = {
  plugins: [prettierPluginEmberTemplateTag],
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
