/**
 * Build an import statement string from its parts.
 *
 * @param {string} source - The import source (e.g. "@ember/object").
 * @param {Object} [options]
 * @param {string|null} [options.defaultImport] - Default import name, or null.
 * @param {string[]} [options.namedImports] - Named import specifiers (may include aliases like "foo as bar").
 * @param {boolean} [options.typeOnly] - Emit a TypeScript `import type` statement.
 * @param {string} [options.quote] - Quote style: `"` (default) or `'`.
 * @returns {string} A complete import statement string.
 */
export function buildImportStatement(
  source,
  { defaultImport = null, namedImports = [], typeOnly = false } = {}
) {
  let stmt = typeOnly ? "import type " : "import ";
  if (defaultImport) {
    stmt += defaultImport;
    if (namedImports.length > 0) {
      stmt += ", ";
    }
  }
  if (namedImports.length > 0) {
    stmt += `{ ${namedImports.join(", ")} }`;
  }
  stmt += ` from "${source}";`;
  return stmt;
}

/**
 * Fix an import declaration. Removes it when no imports are left.
 *
 * @param {ASTNode} importDeclarationNode - The AST node representing the import declaration.
 * @param {Object} options - Options for modifying the import statement.
 * @param {undefined|false|string} options.defaultImport - Undefined to leave default import unchanged. False to remove it. String to set it to the given name, if it doesn't already exist.
 * @param {string[]} options.namedImportsToAdd - Named imports to add to the import statement.
 * @param {string[]} options.namedImportsToRemove - Named imports to remove from the import statement.
 */
export function fixImport(
  fixer,
  importDeclarationNode,
  { defaultImport, namedImportsToAdd = [], namedImportsToRemove = [] }
) {
  const existingSpecifiers = importDeclarationNode.specifiers;
  const existingDefaultImport = existingSpecifiers.find(
    (specifier) => specifier.type === "ImportDefaultSpecifier"
  );

  // Map existing named imports to their local names
  const existingNamedImports = existingSpecifiers
    .filter((specifier) => specifier.type === "ImportSpecifier")
    .reduce((acc, specifier) => {
      acc[specifier.imported.name] = specifier.local.name;
      return acc;
    }, {});

  // Determine final default import
  let finalDefaultImport;
  if (defaultImport === undefined) {
    finalDefaultImport = existingDefaultImport
      ? existingDefaultImport.local.name
      : null;
  } else if (defaultImport) {
    finalDefaultImport = existingDefaultImport
      ? existingDefaultImport.local.name
      : defaultImport;
  } else {
    finalDefaultImport = null;
  }

  // Determine final named imports, preserving aliases
  const finalNamedImports = Array.from(
    new Set([
      ...Object.entries(existingNamedImports)
        .filter(([imported]) => !namedImportsToRemove.includes(imported))
        .map(([imported, local]) =>
          imported === local ? imported : `${imported} as ${local}`
        ),
      ...namedImportsToAdd,
    ])
  );

  if (!finalDefaultImport && finalNamedImports.length === 0) {
    return fixer.remove(importDeclarationNode);
  }

  const newImportStatement = buildImportStatement(
    importDeclarationNode.source.value,
    { defaultImport: finalDefaultImport, namedImports: finalNamedImports }
  );

  // Replace the entire import declaration
  return fixer.replaceText(importDeclarationNode, newImportStatement);
}
