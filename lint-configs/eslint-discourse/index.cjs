module.exports = {
  meta: {
    name: "eslint-discourse",
  },
  configs: {},
  rules: {
    "i18n-import": require("./i18n-import.cjs"),
  },
  processors: {},
};
