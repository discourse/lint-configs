const eslint = require("eslint-config-discourse/eslint");

module.exports = [
  ...eslint,
  {
    ignores: ["javascripts/vendor/*"],
    languageOptions: {
      globals: {
        settings: "readonly",
        themePrefix: "readonly",
      },
    },
  },
];
