import eslint from "@discourse/lint-configs/eslint";

export default [
  ...eslint,
  {
    files: "*",
    ignores: ["javascripts/vendor/*"],
    languageOptions: {
      globals: {
        settings: "readonly",
        themePrefix: "readonly",
      },
    },
  },
];
