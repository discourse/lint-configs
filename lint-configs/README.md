# @discourse/lint-configs

Shareable lint configs for Discourse core, plugins, and themes

## Usage

Add `@discourse/lint-configs` to package.json, and create these three files:

### .eslintrc.cjs

```js
module.exports = require("@discourse/lint-configs/eslint");
```

or in themes/theme components:

```js
module.exports = require("@discourse/lint-configs/eslint-theme");
```

### .prettierrc.cjs

```js
module.exports = require("@discourse/lint-configs/prettier");
```

### .template-lintrc.cjs

```js
module.exports = require("@discourse/lint-configs/template-lint");
```
