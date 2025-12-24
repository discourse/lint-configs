// Generic utilities to inspect ImportDeclaration nodes in a source AST.
// These helpers are intentionally generic so they can be reused by multiple
// lint rules in this repo instead of containing rule-specific logic.

/**
 * @typedef {import('estree').Node} Node
 * @typedef {import('estree').ImportDeclaration} ImportDeclaration
 * @typedef {Object} ImportInfo
 * @property {ImportDeclaration} node - The ImportDeclaration AST node
 * @property {Array<import('estree').ImportSpecifier|import('estree').ImportDefaultSpecifier|import('estree').ImportNamespaceSpecifier>} specifiers - The import specifiers
 */

/**
 * Collects all ImportDeclaration nodes from the provided ESLint SourceCode
 * and returns a Map keyed by the import source string (e.g. "@ember/object").
 *
 * The resulting Map values are objects with the original ImportDeclaration
 * node and a shallow copy of its specifiers. Rules can use this to inspect
 * existing imports and build fixes that modify or add import statements.
 *
 * @param {import('eslint').SourceCode} sourceCode - ESLint SourceCode object
 * @returns {Map<string, ImportInfo>} Map from import source value to import info
 */
export function collectImports(sourceCode) {
  const imports = new Map();

  sourceCode.ast.body.forEach((statement) => {
    if (statement && statement.type === "ImportDeclaration") {
      const sourceValue = statement.source && statement.source.value;
      if (!imports.has(sourceValue)) {
        imports.set(sourceValue, {
          node: statement,
          specifiers: Array.isArray(statement.specifiers)
            ? statement.specifiers.slice()
            : [],
        });
      }
    }
  });

  return imports;
}

/**
 * Returns the set of all locally imported identifier names in the file. This
 * is useful to detect name collisions before inserting new imports (for
 * example, to decide whether to alias an imported identifier).
 *
 * @param {import('eslint').SourceCode} sourceCode - ESLint SourceCode object
 * @returns {Set<string>} Set of local import names
 */
export function getImportedLocalNames(sourceCode) {
  const names = new Set();
  const imports = collectImports(sourceCode);

  for (const { specifiers } of imports.values()) {
    specifiers.forEach((spec) => {
      if (spec && spec.local && spec.local.name) {
        names.add(spec.local.name);
      }
    });
  }

  return names;
}
