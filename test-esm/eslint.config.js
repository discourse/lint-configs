import eslint from "eslint-config-discourse/eslint";

export default [
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
