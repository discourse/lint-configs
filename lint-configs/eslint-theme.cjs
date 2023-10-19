const eslint = require("./eslintrc.cjs");

const config = { ...eslint };
config.ignorePatterns = ["javascripts/vendor/*"];
config.overrides.push({
  files: ["*.js", "*.gjs"],
  globals: {
    settings: "readonly",
    themePrefix: "readonly",
  },
});

module.exports = config;
