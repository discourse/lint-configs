import { getNamedImportLocalNames } from "./analyze-imports.mjs";

/**
 * Returns the local names `tracked` is imported as from `@glimmer/tracking`.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @returns {Set<string>}
 */
export function getTrackedImportNames(sourceCode) {
  return getNamedImportLocalNames(sourceCode, "@glimmer/tracking", "tracked");
}

/**
 * Whether a class member is decorated with a bare `@tracked`.
 *
 * @param {import('estree').Node} node - a class property node
 * @param {Set<string>} [names] - local names of `tracked`
 * @returns {boolean}
 */
export function hasTrackedDecorator(node, names = new Set(["tracked"])) {
  return (node.decorators ?? []).some((decorator) => {
    return (
      decorator.expression.type === "Identifier" &&
      names.has(decorator.expression.name)
    );
  });
}
