const eslint = require("eslint-config-discourse/eslint");

module.exports = {
  ...eslint,
  ignorePatterns: ["javascripts/vendor/*"],
  globals: {
    settings: "readonly",
    themePrefix: "readonly",
  },
};
