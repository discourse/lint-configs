/**
 * @fileoverview Fixer logic for the `no-computed-macros` ESLint rule.
 *
 * Generates ESLint fixer functions that replace a macro-decorated
 * PropertyDefinition with a native getter, adjusting decorators.
 * New `@tracked` declarations for local deps are prepended to the replacement
 * text (rather than using a separate insertTextBefore) to avoid range overlaps.
 * Decorating *existing* class members with `@tracked` is handled centrally in
 * the import-level fix (see `no-computed-macros.mjs`) to avoid duplication.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a fixer function for a single macro usage.
 *
 * The returned function replaces the PropertyDefinition (including its
 * decorators) with an optional block of `@tracked` declarations followed
 * by a `@computed(...)` or `@dependentKeyCompat` getter.
 *
 * Note: decorating *existing* class members with `@tracked` is NOT handled
 * here — it's aggregated in the import-level fix to avoid duplication.
 *
 * @param {import('./computed-macros-analysis.mjs').MacroUsage} usage
 * @param {import('eslint').SourceCode} sourceCode
 * @returns {(fixer: import('eslint').Rule.RuleFixer) => import('eslint').Rule.Fix}
 */
export function createMacroFix(usage, sourceCode) {
  return function (fixer) {
    const indent = detectIndent(usage.propertyNode, sourceCode);
    const getterCode = buildGetterCode(usage, indent, sourceCode);

    // Prepend @tracked declarations for local deps that need a NEW member
    let trackedPrefix = "";
    if (usage.allLocal && usage.trackedDeps?.length > 0) {
      trackedPrefix = buildTrackedPrefix(usage, indent);
    }

    const start = getNodeStart(usage, sourceCode);
    const end = getNodeEnd(usage.propertyNode, sourceCode);
    return fixer.replaceTextRange([start, end], trackedPrefix + getterCode);
  };
}

// ---------------------------------------------------------------------------
// Getter code generation
// ---------------------------------------------------------------------------

/**
 * Build the full getter code string including decorator.
 *
 * @param {import('./computed-macros-analysis.mjs').MacroUsage} usage
 * @param {string} indent
 * @param {import('eslint').SourceCode} sourceCode
 * @returns {string}
 */
function buildGetterCode(usage, indent, sourceCode) {
  const {
    transform,
    propName,
    allLocal,
    dependentKeys,
    literalArgs,
    argNodes,
  } = usage;
  const transformArgs = { literalArgs, argNodes, propName, sourceCode };
  const bodyRaw = transform.toGetterBody(transformArgs);

  // Build decorator line
  let decoratorLine;
  if (allLocal) {
    decoratorLine = `${indent}@dependentKeyCompat`;
  } else {
    const keys = dependentKeys.map((k) => JSON.stringify(k)).join(", ");
    decoratorLine = `${indent}@computed(${keys})`;
  }

  // Build getter body — handle multi-line bodies (e.g. sort)
  const bodyLines = bodyRaw.split("\n");
  const bodyIndent = `${indent}  `;
  const formattedBody = bodyLines
    .map((line) => `${bodyIndent}${line}`)
    .join("\n");

  return [
    decoratorLine,
    `${indent}get ${propName}() {`,
    formattedBody,
    `${indent}}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// @tracked prefix
// ---------------------------------------------------------------------------

/**
 * Build `@tracked propName;` declarations to prepend before the getter.
 * `trackedDeps` already contains only deps that need a NEW declaration
 * (not existing class members — those are handled separately via
 * `existingNodesToDecorate`).
 *
 * @param {import('./computed-macros-analysis.mjs').MacroUsage} usage
 * @param {string} indent
 * @returns {string}
 */
function buildTrackedPrefix(usage, indent) {
  return usage.trackedDeps.map((dep) => `${indent}@tracked ${dep};\n`).join("");
}

// ---------------------------------------------------------------------------
// Node range helpers
// ---------------------------------------------------------------------------

/**
 * Get the start position of a usage, including its decorators AND any
 * leading whitespace on the same line. This ensures the replacement range
 * covers the full indentation so the generated code can control its own
 * indentation without doubling.
 */
function getNodeStart(usage, sourceCode) {
  const { propertyNode } = usage;
  const text = sourceCode.getText();
  let pos =
    propertyNode.decorators?.length > 0
      ? propertyNode.decorators[0].range[0]
      : propertyNode.range[0];

  // Walk back to the start of the line (past whitespace)
  while (pos > 0 && text[pos - 1] !== "\n") {
    pos--;
  }

  return pos;
}

/**
 * Get the end position of a PropertyDefinition, consuming trailing semicolons.
 */
function getNodeEnd(node, sourceCode) {
  let end = node.range[1];
  const text = sourceCode.getText();
  while (end < text.length && text[end] === ";") {
    end++;
  }
  return end;
}

// ---------------------------------------------------------------------------
// Indentation helpers
// ---------------------------------------------------------------------------

/**
 * Detect the indentation of a node by looking at leading whitespace.
 */
function detectIndent(node, sourceCode) {
  const text = sourceCode.getText();
  let pos =
    node.decorators?.length > 0 ? node.decorators[0].range[0] : node.range[0];

  while (pos > 0 && text[pos - 1] !== "\n") {
    pos--;
  }

  let indent = "";
  while (pos < text.length && (text[pos] === " " || text[pos] === "\t")) {
    indent += text[pos];
    pos++;
  }

  return indent;
}
