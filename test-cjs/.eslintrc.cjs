const eslint = require("eslint-config-discourse/eslint");

const config = { ...eslint };
config.ignorePatterns = ["javascripts/vendor/*"];
config.config.overrides.push({
  globals: {
    settings: "readonly",
    themePrefix: "readonly",
  },
});

module.exports = config;
