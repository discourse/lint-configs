/**
 * @fileoverview Fixer logic for the `no-computed-macros` ESLint rule.
 *
 * Generates a combined ESLint fixer function per class that:
 * 1. Removes each macro PropertyDefinition (replacing with @tracked
 *    declarations when needed)
 * 2. Inserts all generated getters at the correct class body position
 *    (the [everything-else] section, after all property-like members)
 * 3. Adds @tracked to existing class members that need it
 *
 * This "remove + insert elsewhere" approach produces correct
 * sort-class-members order in a single --fix pass, avoiding the messy
 * intermediate state of in-place replacement.
 */

// Names of lifecycle methods that have their own sort-class-members slot
// (they come before [everything-else] in the sort order).
const LIFECYCLE_METHODS = new Set(["constructor", "init", "willDestroy"]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a combined fixer function for ALL fixable macro usages in one class.
 *
 * The returned function produces an array of Fix objects that:
 * - Remove/replace each macro PropertyDefinition
 * - Add @tracked to existing class members
 * - Insert all generated getters at the correct position
 *
 * @param {import('./computed-macros-analysis.mjs').MacroUsage[]} classUsages
 * @param {Set<import('estree').Node>} existingNodesToDecorate
 * @param {import('eslint').SourceCode} sourceCode
 * @returns {(fixer: import('eslint').Rule.RuleFixer) => import('eslint').Rule.Fix[]}
 */
export function createClassFix(
  classUsages,
  existingNodesToDecorate,
  sourceCode
) {
  return function (fixer) {
    const fixes = [];
    const text = sourceCode.getText();
    const classBody = classUsages[0].propertyNode.parent;
    const indent = detectIndent(classUsages[0].propertyNode, sourceCode);
    const macroNodeSet = new Set(classUsages.map((u) => u.propertyNode));

    // 1. Remove/replace each macro PropertyDefinition
    const seenTrackedDeps = new Set();
    for (const usage of classUsages) {
      const start = getNodeStart(usage, sourceCode);
      let end = getNodeEnd(usage.propertyNode, sourceCode);
      // Consume trailing newline for clean line removal
      if (end < text.length && text[end] === "\n") {
        end++;
      }

      let replacement = "";
      if (usage.allLocal && usage.trackedDeps?.length > 0) {
        // Deduplicate tracked deps across usages in the same class
        const newDeps = usage.trackedDeps.filter(
          (d) => !seenTrackedDeps.has(d)
        );
        for (const d of newDeps) {
          seenTrackedDeps.add(d);
        }
        if (newDeps.length > 0) {
          replacement = newDeps
            .map((dep) => `${indent}@tracked ${dep};\n`)
            .join("");
        }
      }

      fixes.push(fixer.replaceTextRange([start, end], replacement));
    }

    // 2. Add @tracked to existing class members
    for (const memberNode of existingNodesToDecorate) {
      fixes.push(fixer.insertTextBefore(memberNode, "@tracked "));
    }

    // 3. Insert all getters at the correct position
    const getterTexts = classUsages.map((u) =>
      buildGetterCode(u, indent, sourceCode)
    );
    const allGettersText = getterTexts.join("\n");

    const insertPos = findGetterInsertionPoint(
      classBody,
      macroNodeSet,
      sourceCode
    );
    const hasContent = hasContentBeforeInsertion(
      classUsages,
      classBody,
      macroNodeSet,
      insertPos
    );
    // Blank line before getters when there's content above (field → method)
    const prefix = hasContent ? "\n" : "";

    fixes.push(
      fixer.insertTextBeforeRange(
        [insertPos, insertPos],
        prefix + allGettersText + "\n"
      )
    );

    return fixes;
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
// Insertion point logic
// ---------------------------------------------------------------------------

/**
 * Find the character position where generated getters should be inserted.
 *
 * Strategy (matches sort-class-members order):
 * 1. If there's a non-static, non-macro instance MethodDefinition that is NOT
 *    a lifecycle method, insert before it (start of [everything-else] section).
 *    Static methods come before all instance members in the sort order, so
 *    they must be skipped.
 * 2. Otherwise, if there's a last non-macro member, insert after it.
 * 3. Fallback: insert before the closing `}` of the class body.
 *
 * @param {import('estree').ClassBody} classBody
 * @param {Set<import('estree').Node>} macroNodeSet
 * @param {import('eslint').SourceCode} sourceCode
 * @returns {number} Character position at the start of a line
 */
function findGetterInsertionPoint(classBody, macroNodeSet, sourceCode) {
  const text = sourceCode.getText();
  const members = classBody.body;

  // Look for the first non-static, non-macro instance MethodDefinition
  // that isn't a lifecycle method. Static methods come before all instance
  // members in the sort order, so inserting among them would be wrong.
  for (const member of members) {
    if (macroNodeSet.has(member) || member.static) {
      continue;
    }
    if (member.type === "MethodDefinition") {
      const name = member.key?.name;
      if (!LIFECYCLE_METHODS.has(name)) {
        // Insert before this method's line
        return lineStartOf(member, text);
      }
    }
  }

  // No existing instance method found. Insert after the last non-macro member
  // (including static members — they precede [everything-else] in sort order).
  let lastNonMacro = null;
  for (const member of members) {
    if (!macroNodeSet.has(member)) {
      lastNonMacro = member;
    }
  }

  if (lastNonMacro) {
    // Position after this member's line (past semicolons and newline)
    let pos = lastNonMacro.range[1];
    while (pos < text.length && text[pos] === ";") {
      pos++;
    }
    if (pos < text.length && text[pos] === "\n") {
      pos++;
    }
    return pos;
  }

  // Fallback: before the closing `}` of the class body
  return lineStartOf({ range: [classBody.range[1] - 1] }, text);
}

/**
 * Get the start-of-line position for a node (walks back past whitespace).
 *
 * @param {{ range?: number[], decorators?: Array<{ range: number[] }> }} node
 * @param {string} text
 * @returns {number}
 */
function lineStartOf(node, text) {
  let pos =
    node.decorators?.length > 0 ? node.decorators[0].range[0] : node.range[0];

  while (pos > 0 && text[pos - 1] !== "\n") {
    pos--;
  }
  return pos;
}

/**
 * Check whether there will be visible content before the getter insertion
 * point after fixes are applied. Used to decide whether to add a blank-line
 * prefix (`\n`) before the getters.
 *
 * @param {import('./computed-macros-analysis.mjs').MacroUsage[]} classUsages
 * @param {import('estree').ClassBody} classBody
 * @param {Set<import('estree').Node>} macroNodeSet
 * @param {number} insertPos Character position where getters will be inserted
 * @returns {boolean}
 */
function hasContentBeforeInsertion(
  classUsages,
  classBody,
  macroNodeSet,
  insertPos
) {
  // True if any macro replacement produces @tracked declarations
  // (these are placed at the macro's original position, before the insertion)
  const hasTrackedDeps = classUsages.some(
    (u) => u.allLocal && u.trackedDeps?.length > 0
  );
  if (hasTrackedDeps) {
    return true;
  }
  // True if there are non-macro members before the insertion point
  return classBody.body.some(
    (m) => !macroNodeSet.has(m) && m.range[0] < insertPos
  );
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
