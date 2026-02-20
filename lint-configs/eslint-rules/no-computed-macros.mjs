/**
 * @fileoverview ESLint rule to replace computed property macro decorators
 * from `@ember/object/computed` and `discourse/lib/computed` with native
 * getters using `@computed` or `@dependentKeyCompat` + `@tracked`.
 */

import { analyzeMacroUsage } from "./no-computed-macros/computed-macros-analysis.mjs";
import { createClassFix } from "./no-computed-macros/computed-macros-fixer.mjs";
import { MACRO_SOURCES } from "./no-computed-macros/macro-transforms.mjs";
import {
  collectImports,
  getImportedLocalNames,
} from "./utils/analyze-imports.mjs";
import { buildImportStatement, fixImport } from "./utils/fix-import.mjs";

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Replace computed property macros with native getters",
    },
    fixable: "code",
    schema: [],
    messages: {
      replaceMacro: "Replace '@{{name}}' macro with a native getter.",
      addTracked:
        "Add @tracked to '{{name}}' (dependency of a converted macro).",
      cannotAutoFixClassic:
        "Cannot auto-fix '{{name}}' in a classic .extend() class. Convert to native ES6 class first.",
      cannotAutoFixComplex: "Cannot auto-fix '{{name}}': {{reason}}.",
      cannotAutoFixDynamic:
        "Cannot auto-fix '@{{name}}' because it has non-literal arguments.",
      cannotAutoFixSelfReference:
        "Cannot auto-fix '@{{name}}' because property '{{propName}}' references itself.",
    },
  },

  create(context) {
    const sourceCode = context.getSourceCode();
    let analysis = null;
    let importsMap = null;
    let importFixGenerated = false;

    function ensureAnalysis() {
      if (analysis) {
        return analysis;
      }
      importsMap = collectImports(sourceCode);
      analysis = analyzeMacroUsage(sourceCode, importsMap);
      return analysis;
    }

    // Precompute per-class fixable usages and existing nodes to decorate.
    // Lazily initialised on first access (like analysis).
    let classFixes = null;
    function ensureClassFixes() {
      if (classFixes) {
        return classFixes;
      }
      const { usages } = ensureAnalysis();
      classFixes = new Map();

      for (const usage of usages) {
        if (!usage.canAutoFix) {
          continue;
        }
        const classBody = usage.propertyNode.parent;
        if (!classFixes.has(classBody)) {
          classFixes.set(classBody, {
            fixableUsages: [],
            existingNodesToDecorate: new Set(),
          });
        }
        const entry = classFixes.get(classBody);
        entry.fixableUsages.push(usage);
        if (usage.existingNodesToDecorate) {
          for (const node of usage.existingNodesToDecorate) {
            entry.existingNodesToDecorate.add(node);
          }
        }
      }

      return classFixes;
    }

    // Track which class bodies have already had a combined fix attached
    const classFixAttached = new Set();

    return {
      // Report on macro import declarations — only the import-level fix here
      ImportDeclaration(node) {
        if (!MACRO_SOURCES.has(node.source.value)) {
          return;
        }

        const { usages, importedMacros, macroImportNodes } = ensureAnalysis();

        const macroSpecifiers = node.specifiers.filter(
          (spec) =>
            spec.type === "ImportSpecifier" &&
            importedMacros.has(spec.local.name)
        );

        if (macroSpecifiers.length === 0) {
          return;
        }

        const fixableUsages = usages.filter((u) => u.canAutoFix);
        const hasAnyFix = fixableUsages.length > 0;

        // Build the import fix ONCE across all macro import declarations.
        // When a file imports from both @ember/object/computed and
        // discourse/lib/computed, we must handle all import nodes in a
        // single fix to avoid duplicate new import lines.
        let importFix;
        if (hasAnyFix && !importFixGenerated) {
          importFixGenerated = true;
          importFix = (fixer) =>
            buildImportFixes(fixer, {
              sourceCode,
              importsMap,
              usages: fixableUsages,
              macroImportNodes,
            });
        }

        let fixAttached = false;
        for (const spec of macroSpecifiers) {
          const macroName = importedMacros.get(spec.local.name);
          context.report({
            node: spec,
            messageId: "replaceMacro",
            data: { name: macroName },
            fix: !fixAttached ? importFix : undefined,
          });
          fixAttached = true;
        }
      },

      // Report on each macro usage in class bodies.
      // The combined class-body fix (remove macros + insert getters at the
      // correct position) is attached to the FIRST fixable macro per class.
      PropertyDefinition(node) {
        if (!node.decorators) {
          return;
        }

        const { usages } = ensureAnalysis();
        const usage = usages.find((u) => u.propertyNode === node);

        if (!usage) {
          return;
        }

        let fix;
        if (usage.canAutoFix) {
          const classBody = node.parent;
          const fixesMap = ensureClassFixes();
          const classEntry = fixesMap.get(classBody);
          if (classEntry && !classFixAttached.has(classBody)) {
            classFixAttached.add(classBody);
            fix = createClassFix(
              classEntry.fixableUsages,
              classEntry.existingNodesToDecorate,
              sourceCode
            );
          }
        }

        context.report({
          node: usage.decoratorNode || node,
          messageId: usage.messageId || "replaceMacro",
          data: usage.reportData || { name: usage.macroName },
          fix,
        });
      },

      // Report on classic .extend() usage
      CallExpression(node) {
        const { usages } = ensureAnalysis();

        for (const usage of usages) {
          if (
            usage.messageId === "cannotAutoFixClassic" &&
            usage.propertyNode?.parent === node.arguments?.[0]
          ) {
            context.report({
              node: usage.propertyNode,
              messageId: usage.messageId,
              data: usage.reportData,
            });
          }
        }
      },

      // Report @tracked additions for existing class members.
      // The actual fix is included in the combined class-body fix
      // (attached to the first fixable macro in each class) to avoid
      // overlapping fix ranges.
      "Program:exit"() {
        const { usages } = ensureAnalysis();
        const decorated = new Set();

        for (const usage of usages) {
          if (!usage.canAutoFix || !usage.existingNodesToDecorate) {
            continue;
          }
          for (const memberNode of usage.existingNodesToDecorate) {
            if (decorated.has(memberNode)) {
              continue;
            }
            decorated.add(memberNode);

            const name =
              memberNode.key.type === "Identifier"
                ? memberNode.key.name
                : String(memberNode.key.value);
            context.report({
              node: memberNode,
              messageId: "addTracked",
              data: { name },
            });
          }
        }
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Import fix builder
// ---------------------------------------------------------------------------

/**
 * Build import-related fixes for ALL fixable macro usages.
 *
 * This function handles ALL macro import nodes at once to avoid producing
 * duplicate new import lines when a file imports macros from both
 * `@ember/object/computed` and `discourse/lib/computed`.
 *
 * Note: adding `@tracked` to existing class members is handled by the
 * combined class-body fix (in `createClassFix`), not here.
 *
 * @returns {import('eslint').Rule.Fix[]}
 */
function buildImportFixes(
  fixer,
  { sourceCode, importsMap, usages, macroImportNodes }
) {
  const fixes = [];
  const allImportedNames = getImportedLocalNames(sourceCode);

  // Exclude names we're about to remove from the collision set
  const fixableLocalNames = new Set(usages.map((u) => u.localName));
  for (const name of fixableLocalNames) {
    allImportedNames.delete(name);
  }

  // Collect all required new imports from fixable usages
  const newImports = collectRequiredImports(usages);

  // Determine conditional imports based on dep classification
  const needsComputed = usages.some((u) => !u.allLocal);
  const needsDependentKeyCompat = usages.some((u) => u.allLocal);
  const needsTracked = usages.some(
    (u) =>
      u.allLocal &&
      (u.trackedDeps?.length > 0 || u.existingNodesToDecorate?.length > 0)
  );

  // Add in the order we want them to appear in the output
  if (needsTracked) {
    addToImportSet(newImports, "@glimmer/tracking", "tracked");
  }
  if (needsComputed) {
    addToImportSet(newImports, "@ember/object", "computed");
  }
  if (needsDependentKeyCompat) {
    addToImportSet(newImports, "@ember/object/compat", "dependentKeyCompat");
  }

  // Build new import lines for required imports (once for all macro sources)
  const newImportLines = [];
  for (const [source, names] of newImports) {
    const existing = importsMap.get(source);

    if (existing) {
      // Modify existing import — generate a fixImport call
      const existingNamedSet = new Set(
        existing.specifiers
          .filter((s) => s.type === "ImportSpecifier")
          .map((s) => s.imported.name)
      );
      const defaultSpec = existing.specifiers.find(
        (s) => s.type === "ImportDefaultSpecifier"
      );

      const namedToAdd = [];
      let defaultToAdd;

      for (const { name, isDefault } of names) {
        if (isDefault) {
          if (!defaultSpec) {
            defaultToAdd = name;
          }
        } else if (!existingNamedSet.has(name)) {
          const localName = allImportedNames.has(name) ? `${name}Import` : name;
          namedToAdd.push(
            localName === name ? name : `${name} as ${localName}`
          );
        }
      }

      if (namedToAdd.length > 0 || defaultToAdd) {
        fixes.push(
          fixImport(fixer, existing.node, {
            defaultImport: defaultToAdd,
            namedImportsToAdd: namedToAdd,
          })
        );
      }
    } else {
      // Build a new import line string (will be appended below)
      newImportLines.push(
        resolveNewImportLine(source, names, allImportedNames)
      );
    }
  }

  // Process each macro import node — remove/replace specifiers
  let newImportsPlaced = false;
  for (const [, importNode] of macroImportNodes) {
    const removableSpecifiers = importNode.specifiers.filter(
      (spec) =>
        spec.type === "ImportSpecifier" &&
        fixableLocalNames.has(spec.local.name) &&
        usages
          .filter((u) => u.localName === spec.local.name)
          .every((u) => u.canAutoFix)
    );
    const remainingSpecifiers = importNode.specifiers.filter(
      (s) => !removableSpecifiers.includes(s)
    );

    if (removableSpecifiers.length === 0) {
      continue;
    }

    if (remainingSpecifiers.length === 0) {
      // All specifiers removed — replace with new imports or remove entirely
      if (!newImportsPlaced && newImportLines.length > 0) {
        fixes.push(fixer.replaceText(importNode, newImportLines.join("\n")));
        newImportsPlaced = true;
      } else {
        // Remove the entire import line (including trailing newline)
        const text = sourceCode.getText();
        let end = importNode.range[1];
        if (end < text.length && text[end] === "\n") {
          end++;
        }
        fixes.push(fixer.removeRange([importNode.range[0], end]));
      }
    } else {
      // Some specifiers remain — remove fixable ones
      const namesToRemove = removableSpecifiers.map((s) => s.imported.name);
      fixes.push(
        fixImport(fixer, importNode, {
          namedImportsToRemove: namesToRemove,
        })
      );

      // Append new import lines after this import (only once)
      if (!newImportsPlaced && newImportLines.length > 0) {
        for (const line of newImportLines) {
          fixes.push(fixer.insertTextAfter(importNode, `\n${line}`));
        }
        newImportsPlaced = true;
      }
    }
  }

  return fixes;
}

/**
 * Resolve import names (handling collisions) and delegate to
 * the shared `buildImportStatement` utility.
 *
 * @param {string} source
 * @param {Array<{name: string, isDefault?: boolean}>} names
 * @param {Set<string>} allImportedNames
 * @returns {string}
 */
function resolveNewImportLine(source, names, allImportedNames) {
  const namedImports = [];
  let defaultImport;

  for (const { name, isDefault } of names) {
    if (isDefault) {
      defaultImport = name;
    } else {
      const localName = allImportedNames.has(name) ? `${name}Import` : name;
      namedImports.push(localName === name ? name : `${name} as ${localName}`);
    }
  }

  return buildImportStatement(source, { defaultImport, namedImports });
}

// ---------------------------------------------------------------------------
// Import helpers
// ---------------------------------------------------------------------------

/**
 * Collect all required imports from fixable usages into a Map.
 */
function collectRequiredImports(usages) {
  const result = new Map();

  for (const usage of usages) {
    if (!usage.canAutoFix || !usage.transform.requiredImports) {
      continue;
    }
    for (const req of usage.transform.requiredImports) {
      addToImportSet(result, req.source, req.name, req.isDefault);
    }
  }

  return result;
}

/**
 * Add a named or default import to the import set, avoiding duplicates.
 */
function addToImportSet(importSet, source, name, isDefault = false) {
  if (!importSet.has(source)) {
    importSet.set(source, []);
  }
  const list = importSet.get(source);
  if (!list.some((i) => i.name === name && i.isDefault === isDefault)) {
    list.push({ name, isDefault });
  }
}
