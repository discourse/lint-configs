const eslint = require("@discourse/lint-configs/eslint");

const config = { ...eslint };
config.ignorePatterns = ["javascripts/vendor/*"];
config.overrides.push({
  files: "*",
  globals: {
    settings: "readonly",
    themePrefix: "readonly",
  },
});

module.exports = config;
