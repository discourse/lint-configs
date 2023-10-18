const eslint = require("./eslintrc");

const config = { ...eslint };
config.ignorePatterns = ["javascripts/vendor/*"];
config.overrides.push({
  globals: {
    settings: "readonly",
    themePrefix: "readonly",
  },
});

module.exports = config;
