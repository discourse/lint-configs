module.exports = {
  extends: ["recommended", "stylistic"],
  rules: {
    // Intentionally disabled default rules
    "no-autofocus-attribute": false,
    "no-positive-tabindex": false,
    "require-mandatory-role-attributes": false,
    "require-media-caption": false,

    // Pending default rules
    "link-href-attributes": false,
    "no-action": false,
    "no-curly-component-invocation": false,
    "no-duplicate-landmark-elements": false,
    "no-implicit-this": false,
    "no-inline-styles": false,
    "no-link-to-tagname": false,
    "no-passed-in-event-handlers": false,
    "no-route-action": false,
    "require-input-label": false,
    "require-presentational-children": false,
    "require-valid-alt-text": false,

    // Non-default rules
    "no-unnecessary-curly-parens": true,
    "no-unnecessary-curly-strings": true,
    "simple-modifiers": true,

    // Pending non-default rules
    "attribute-order": false,
    "inline-link-to": false,
    "no-action-modifiers": false,
    "no-builtin-form-components": false,
    "no-this-in-template-only-components": false, // emits false-positives in gjs

    // GJS compatibility
    "modifier-name-case": false,

    // Prettier compatibility
    "block-indentation": false,
    "eol-last": false,
    quotes: false,
    "self-closing-void-elements": false,
  },
};
