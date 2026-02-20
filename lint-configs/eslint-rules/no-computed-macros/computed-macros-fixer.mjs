/**
 * @fileoverview Fixer logic for the `no-computed-macros` ESLint rule.
 *
 * Generates a combined ESLint fixer function per class that:
 * 1. Removes each macro PropertyDefinition
 * 2. Collects all @tracked declarations (new + moved) and inserts them
 *    at the [tracked-properties] section
 * 3. Inserts all generated getters at the correct class body position
 *    (the [everything-else] section, after all property-like members)
 *
 * This "remove + insert elsewhere" approach produces correct
 * sort-class-members order in a single --fix pass, avoiding the messy
 * intermediate state of in-place replacement.
 */

// Names of lifecycle methods that have their own sort-class-members slot
// (they come before [everything-else] in the sort order).
const LIFECYCLE_METHODS = new Set(["constructor", "init", "willDestroy"]);

// Decorators that make a property reactive (equivalent to @tracked).
// Members with these decorators do not need @tracked added.
const TRACKED_DECORATORS = new Set([
  "tracked",
  "trackedArray",
  "dedupeTracked",
  "resettableTracked",
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a combined fixer function for ALL fixable macro usages in one class.
 *
 * The returned function produces an array of Fix objects that:
 * - Remove each macro PropertyDefinition
 * - Collect and insert @tracked declarations at the tracked section
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

    // ---- 1. Remove all macro PropertyDefinitions ----
    for (const usage of classUsages) {
      let start = getNodeStart(usage, sourceCode);
      let end = getNodeEnd(usage.propertyNode, sourceCode);
      // Consume trailing newline for clean line removal
      if (end < text.length && text[end] === "\n") {
        end++;
      }
      // Consume one preceding blank line to avoid orphaned double blank
      // lines after the macro is removed
      if (start >= 2 && text[start - 1] === "\n" && text[start - 2] === "\n") {
        start--;
      }
      fixes.push(fixer.replaceTextRange([start, end], ""));
    }

    // ---- 2. Collect @tracked declarations and insert at tracked section ----
    // Both new declarations (from trackedDeps) and moved existing members
    // (from existingNodesToDecorate) are placed together in the
    // [tracked-properties] section for correct sort-class-members order.
    const trackedLines = [];
    const seenTrackedDeps = new Set();
    const processedNodes = new Set();

    for (const usage of classUsages) {
      // New @tracked declarations from trackedDeps
      if (usage.allLocal && usage.trackedDeps?.length > 0) {
        for (const dep of usage.trackedDeps) {
          if (!seenTrackedDeps.has(dep)) {
            seenTrackedDeps.add(dep);
            trackedLines.push(`${indent}@tracked ${dep};\n`);
          }
        }
      }

      // Move existing members with @tracked prepended
      if (usage.existingNodesToDecorate) {
        for (const memberNode of usage.existingNodesToDecorate) {
          if (processedNodes.has(memberNode)) {
            continue;
          }
          processedNodes.add(memberNode);

          // Capture source text (key through trailing semicolons)
          let endPos = memberNode.range[1];
          while (endPos < text.length && text[endPos] === ";") {
            endPos++;
          }
          const memberSource = text.slice(memberNode.range[0], endPos);
          trackedLines.push(`${indent}@tracked ${memberSource}\n`);

          // Remove from original position (full line)
          const removeStart = lineStartOf(memberNode, text);
          let removeEnd = endPos;
          if (removeEnd < text.length && text[removeEnd] === "\n") {
            removeEnd++;
          }
          fixes.push(fixer.replaceTextRange([removeStart, removeEnd], ""));
        }
      }
    }

    if (trackedLines.length > 0) {
      const trackedInsertPos = findTrackedInsertionPoint(
        classBody,
        macroNodeSet,
        existingNodesToDecorate,
        text
      );
      fixes.push(
        fixer.insertTextBeforeRange(
          [trackedInsertPos, trackedInsertPos],
          trackedLines.join("")
        )
      );
    }

    // ---- 3. Insert all getters at the correct position ----
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
 * Find the position to insert @tracked declarations.
 *
 * Strategy: insert right after the last existing @tracked property line
 * (skipping macro nodes and members being moved). Falls back to the start
 * of the class body (after `{\n`) if no @tracked properties exist.
 *
 * @param {import('estree').ClassBody} classBody
 * @param {Set<import('estree').Node>} macroNodeSet
 * @param {Set<import('estree').Node>} existingNodesToDecorate
 * @param {string} text
 * @returns {number}
 */
function findTrackedInsertionPoint(
  classBody,
  macroNodeSet,
  existingNodesToDecorate,
  text
) {
  let lastTrackedEnd = null;

  for (const member of classBody.body) {
    if (macroNodeSet.has(member) || existingNodesToDecorate.has(member)) {
      continue;
    }
    if (member.type !== "PropertyDefinition") {
      continue;
    }

    if (hasTrackedLikeDecorator(member)) {
      let pos = member.range[1];
      while (pos < text.length && text[pos] === ";") {
        pos++;
      }
      if (pos < text.length && text[pos] === "\n") {
        pos++;
      }
      lastTrackedEnd = pos;
    }
  }

  if (lastTrackedEnd !== null) {
    return lastTrackedEnd;
  }

  // No tracked properties found — insert at start of class body
  let pos = classBody.range[0] + 1;
  if (pos < text.length && text[pos] === "\n") {
    pos++;
  }
  return pos;
}

/**
 * Check whether a class member has a tracked-like decorator.
 *
 * @param {import('estree').Node} member
 * @returns {boolean}
 */
function hasTrackedLikeDecorator(member) {
  return (
    member.decorators?.some((d) => {
      const expr = d.expression;
      return (
        (expr.type === "Identifier" && TRACKED_DECORATORS.has(expr.name)) ||
        (expr.type === "CallExpression" &&
          expr.callee?.type === "Identifier" &&
          TRACKED_DECORATORS.has(expr.callee.name))
      );
    }) ?? false
  );
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
  // True if any macro produces @tracked declarations (placed at the
  // tracked section, which is always before the getter insertion point)
  const hasTrackedDeps = classUsages.some(
    (u) => u.allLocal && u.trackedDeps?.length > 0
  );
  if (hasTrackedDeps) {
    return true;
  }
  // True if any existing members are being moved (they get re-inserted
  // at the tracked section, before the getter insertion point)
  const hasExistingToDecorate = classUsages.some(
    (u) => u.existingNodesToDecorate?.length > 0
  );
  if (hasExistingToDecorate) {
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
