module.exports = {
  extends: ["recommended", "stylistic"],
  rules: {
    "no-positive-tabindex": false,
    "no-autofocus-attribute": false,

    // Pending
    "require-presentational-children": false,
    "no-duplicate-landmark-elements": false,
    "no-passed-in-event-handlers": false,
    "no-inline-styles": false,
    "no-link-to-tagname": false,
    "no-implicit-this": false,
    "require-valid-alt-text": false,
    "link-href-attributes": false,
    "no-curly-component-invocation": false,
    "no-link-to-positional-params": false,
    "require-input-label": false,
    "no-route-action": false,
    "no-action": false,

    // Prettier compatibility
    "eol-last": false,
    "self-closing-void-elements": false,
    "block-indentation": false,
    quotes: false,
  },
};
