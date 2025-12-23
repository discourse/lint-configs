# Rule Development Guide

This guide covers creating and fixing lint rules for the Discourse lint-configs project.

## Project StructureAdd

### ESLint
- Rule files: `lint-configs/eslint-rules/` (often using subdirectories for complex rules)
- Test files: `test/eslint-rules/`
- Utilities: `lint-configs/eslint-rules/utils/`

### Template Lint (Ember)
- Rule files: `lint-configs/template-lint-rules/`
- Test files: `test/template-lint-rules/`
- Rule index: `lint-configs/template-lint-rules/index.mjs`

### Stylelint
- Rule files: `lint-configs/stylelint-rules/`
- Test files: `test/stylelint-rules/`
- Rule index: `lint-configs/stylelint-rules/index.js`

## Testing Commands

Run all tests from the root directory:
```bash
cd lint-configs && pnpm test
```

### Individual Rule Testing
To run tests for a specific type of rule:
- ESLint: `cd test/eslint-rules && pnpm test`
- Template Lint: `cd test/template-lint-rules && pnpm test`
- Stylelint: `cd test/stylelint-rules && pnpm test` (uses Node's native test runner)

To run a single test file (ESLint/Template Lint):
```bash
cd test/eslint-rules && npx mocha rule-name.test.mjs
```

## Code Quality and Standards

After making modifications to the rules or utilities, you must ensure the codebase adheres to the project's quality standards.

### Linting
Run the linting command from the `lint-configs` directory:
```bash
cd lint-configs && pnpm lint
```
This runs ESLint and checks formatting with Prettier.

### Formatting
To automatically fix formatting issues, run:
```bash
cd lint-configs && pnpm prettier --write "**/*.{cjs,mjs,js}"
```

## Style Guidelines

The following guidelines ensure the codebase is readable, maintainable, and easy to follow for humans.

### 1. Readable and Maintainable Code
- **Self-Documenting Code**: Choose clear, descriptive names for variables, functions, and parameters.
- **Complexity Management**: Break down complex logic into smaller, focused helper functions. Avoid deep nesting.
- **Intent over Implementation**: Write code that expresses *what* it is doing, making the high-level flow easy to follow.

### 2. Organization and Modularization
- **Separation of Concerns**: Separate analysis (detecting patterns), fixing (transforming code), and reporting (ESLint/Lint integration).
- **Subdirectories for Complex Rules**: If a rule requires significant supporting logic, place it in a subdirectory named after the rule (e.g., `eslint-rules/rule-name/`) and split it into:
  - `rule-name-analysis.mjs`: Read-only AST traversal and pattern detection.
  - `rule-name-fixer.mjs`: Logic for generating fixer commands.
- **Shared Utilities**: Move generic logic (like import handling or property path manipulation) to the `utils/` directory to promote reuse.

### 3. Documentation
- **Clear Comments**: Use comments to explain *why* complex logic is necessary, especially for edge cases or non-obvious AST patterns.
- **JSDoc Types**: Provide JSDoc headers for all exported functions and complex data structures (using `@typedef`). This improves editor tooling and helps other developers understand the data flow.
- **Consistent Rule Metadata**: Ensure every rule has a comprehensive `meta` object with a clear description and descriptive message IDs.

## Available ESLint Utilities

- `fixImport(fixer, importNode, options)`: Manage named/default imports.
- `collectImports(sourceCode)`: Returns a Map of imports indexed by source.
- `getImportedLocalNames(sourceCode)`: Returns a Set of all local names imported in the file.
- `propertyPathToOptionalChaining(path)`: Converts "a.b.c" to "a?.b?.c".
- Token utilities (`isTokenOnSameLine`, `isSemicolonToken`, etc.) in `utils/tokens.mjs`.

## Key Development Patterns

### 1. Prefer AST Over Regex
- **ESLint**: Uses `context.getSourceCode().ast`.
- **Template Lint**: Uses a `visitor()` pattern for Glimmer AST.
- **Stylelint**: Uses PostCSS AST (`root.walkAtRules`, etc.).
- AST analysis avoids false positives in comments/strings and handles whitespace automatically.

### 2. Implementation Strategies

#### ESLint
- Track state (like imports) at the top of `create(context)`.
- Use `ImportDeclaration` visitor to scan all imports at the start to avoid race conditions when fixing.
- When fixing, use `context.report({ fix(fixer) { ... } })`.

#### Template Lint
- Extend `Rule` from `ember-template-lint`.
- Implement `visitor()` returning an object with node handlers (e.g., `MustacheStatement`, `PathExpression`).
- For autofix, modify the node directly in the visitor when `this.mode === 'fix'`.

#### Stylelint
- Use `stylelint.createPlugin(ruleName, ruleFunction)`.
- Use `stylelint.utils.report` for reporting.
- Provide a `fix` callback in `report` to modify the PostCSS nodes.

### 3. Safety and Robustness
- **Avoid Breaking Changes**: Do not auto-fix if it might change runtime behavior (e.g., spreading `undefined` or `null`).
- **Mixed Scenarios**: Handle files that have both fixable and non-fixable issues.
- **Naming Conflicts**: Ensure auto-added imports don't conflict with existing local variables or imports.
- **Optional Chaining**: When converting to getters or property access, consider if the base object might be null/undefined.

## Common Pitfalls
- **Import Aliases**: `import { computed as c }` means you must look for `c`, not `computed`.
- **Classic vs. Native Classes**: Some fixes only work in ES6 classes (e.g., converting to getters).
- **Template Paths**: In Ember templates, `this.property` vs `@arg` vs `helper` can be ambiguous; respect `allow` lists in config.
- **Stylelint @use**: When adding a new mixin/function, ensure the necessary `@use` statement is added at the top of the file if missing.
