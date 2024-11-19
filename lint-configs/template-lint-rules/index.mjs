import NoAtClass from "./no-at-class.mjs";

export default {
  // Name of plugin
  name: "discourse",

  // Define rules for this plugin. Each path should map to a plugin rule
  rules: {
    "discourse/no-at-class": NoAtClass,
  },
};
