module.exports = {
  plugins: ["prettier-plugin-ember-template-tag"],
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
