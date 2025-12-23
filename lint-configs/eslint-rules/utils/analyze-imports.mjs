// Generic utilities to inspect ImportDeclaration nodes in a source AST.
// These helpers are intentionally generic so they can be reused by multiple
// lint rules in this repo instead of containing rule-specific logic.

// collectImports(sourceCode)
// - Returns a Map where the key is the import source string (e.g. '@ember/object')
//   and the value is an object { node: ImportDeclarationNode, specifiers: [...] }
// - This lets callers inspect imports, modify specifiers, or add new imports.
export function collectImports(sourceCode) {
  const imports = new Map();

  sourceCode.ast.body.forEach(statement => {
    if (statement && statement.type === 'ImportDeclaration') {
      const sourceValue = statement.source && statement.source.value;
      if (!imports.has(sourceValue)) {
        imports.set(sourceValue, {
          node: statement,
          specifiers: Array.isArray(statement.specifiers) ? statement.specifiers.slice() : []
        });
      }
    }
  });

  return imports;
}

// getImportedLocalNames(sourceCode)
// - Returns a Set with all local identifier names imported in the file.
// - Useful to detect name collisions before inserting imports.
export function getImportedLocalNames(sourceCode) {
  const names = new Set();
  const imports = collectImports(sourceCode);

  for (const { specifiers } of imports.values()) {
    specifiers.forEach(spec => {
      if (spec && spec.local && spec.local.name) {
        names.add(spec.local.name);
      }
    });
  }

  return names;
}

// Backwards-compatible wrapper for the original rule implementation.
// This keeps existing code working but is implemented using the generic helpers
// above. Callers are encouraged to migrate to `collectImports` + `getImportedLocalNames`.
export function analyzeAllImports(sourceCode) {
  const imports = collectImports(sourceCode);
  const allImportedIdentifiers = getImportedLocalNames(sourceCode);

  let hasComputedImport = false;
  let emberObjectImportNode = null;
  let discourseComputedLocalName = null;
  let discourseComputedImportNode = null;
  let computedImportName = null;

  const emberNode = imports.get('@ember/object');
  if (emberNode) {
    emberObjectImportNode = emberNode.node;
    const computedSpecifier = emberNode.specifiers.find(spec => spec.type === 'ImportSpecifier' && spec.imported && spec.imported.name === 'computed');
    if (computedSpecifier) {
      hasComputedImport = true;
      computedImportName = computedSpecifier.local.name;
    }
  }

  const discourseNode = imports.get('discourse/lib/decorators');
  if (discourseNode) {
    discourseComputedImportNode = discourseNode.node;
    const defaultSpecifier = discourseNode.specifiers.find(spec => spec.type === 'ImportDefaultSpecifier');
    if (defaultSpecifier) {
      discourseComputedLocalName = defaultSpecifier.local.name;
    }
  }

  if (!computedImportName) {
    const isComputedUsedElsewhere = allImportedIdentifiers.has('computed') && discourseComputedLocalName !== 'computed';
    computedImportName = isComputedUsedElsewhere ? 'emberComputed' : 'computed';
  }

  return {
    hasComputedImport,
    emberObjectImportNode,
    discourseComputedLocalName,
    discourseComputedImportNode,
    computedImportName
  };
}
