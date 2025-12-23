import { analyzeDiscourseComputedUsage as analyzeDiscourseComputedUsageUtil } from "./no-discourse-computed/discourse-computed-analysis.mjs";
import { createMethodFix } from "./no-discourse-computed/discourse-computed-fixer.mjs";
import {
  collectImports,
  getImportedLocalNames,
} from "./utils/analyze-imports.mjs";
import { fixImport } from "./utils/fix-import.mjs";

/**
 * Fixer for the discourseComputed import.
 * Handles removing or modifying the import based on whether all usages were converted.
 */
function fixDiscourseImport(
  fixer,
  importNode,
  usageInfo,
  sourceCode,
  hasComputedImport,
  emberObjectImportNode,
  computedImportName,
  discourseComputedLocalName
) {
  const fixes = [];
  const {
    hasFixableDecorators,
    hasClassicClassDecorators,
    hasParameterReassignments,
    hasParametersInSpread,
    hasUnsafeOptionalChaining,
    hasParameterInNestedFunction,
  } = usageInfo;

  // Only provide fixes if there are fixable decorators
  if (!hasFixableDecorators) {
    return fixes;
  }

  // Check if there are other named imports in discourse/lib/decorators
  const namedSpecifiers = importNode.specifiers.filter(
    (spec) => spec.type === "ImportSpecifier"
  );

  // Determine the import string to use (with alias if needed)
  const computedImportString =
    computedImportName === "computed"
      ? "computed"
      : `computed as ${computedImportName}`;

  // If there are no classic class decorators or non-fixable decorators remaining,
  // we can potentially remove the discourseComputed import.
  const hasRemainingUsage =
    hasClassicClassDecorators ||
    hasParameterReassignments ||
    hasParametersInSpread ||
    hasUnsafeOptionalChaining ||
    hasParameterInNestedFunction;

  if (!hasRemainingUsage) {
    if (namedSpecifiers.length > 0) {
      // Keep named imports, remove default import
      fixes.push(
        fixImport(fixer, importNode, {
          defaultImport: false,
        })
      );

      // Add computed to @ember/object import (if not already present)
      if (!hasComputedImport) {
        if (emberObjectImportNode) {
          fixes.push(
            fixImport(fixer, emberObjectImportNode, {
              namedImportsToAdd: [computedImportString],
            })
          );
        } else {
          fixes.push(
            fixer.insertTextAfter(
              importNode,
              `\nimport { ${computedImportString} } from "@ember/object";`
            )
          );
        }
      }
    } else {
      // No named imports, handle entire import line removal or replacement
      if (!hasComputedImport) {
        if (emberObjectImportNode) {
          // Remove discourseComputed import, add computed to @ember/object
          const nextChar = sourceCode.getText().charAt(importNode.range[1]);
          const rangeEnd =
            nextChar === "\n" ? importNode.range[1] + 1 : importNode.range[1];
          fixes.push(fixer.removeRange([importNode.range[0], rangeEnd]));

          fixes.push(
            fixImport(fixer, emberObjectImportNode, {
              namedImportsToAdd: [computedImportString],
            })
          );
        } else {
          // Replace discourseComputed import with @ember/object import
          fixes.push(
            fixer.replaceText(
              importNode,
              `import { ${computedImportString} } from "@ember/object";`
            )
          );
        }
      } else {
        // computed already imported, just remove discourseComputed
        const nextChar = sourceCode.getText().charAt(importNode.range[1]);
        const rangeEnd =
          nextChar === "\n" ? importNode.range[1] + 1 : importNode.range[1];
        fixes.push(fixer.removeRange([importNode.range[0], rangeEnd]));
      }
    }
  } else {
    // Has remaining usages, keep discourseComputed import but add computed for fixable ones

    // If the default import is named 'computed', rename it to 'discourseComputed' to avoid conflict
    if (discourseComputedLocalName === "computed") {
      const namedImportStrings = namedSpecifiers.map((spec) => {
        if (spec.imported.name === spec.local.name) {
          return spec.imported.name;
        } else {
          return `${spec.imported.name} as ${spec.local.name}`;
        }
      });

      let newImportStatement = "import discourseComputed";
      if (namedImportStrings.length > 0) {
        newImportStatement += `, { ${namedImportStrings.join(", ")} }`;
      }
      newImportStatement += ` from "${importNode.source.value}";`;

      fixes.push(fixer.replaceText(importNode, newImportStatement));
    }

    if (!hasComputedImport) {
      if (emberObjectImportNode) {
        fixes.push(
          fixImport(fixer, emberObjectImportNode, {
            namedImportsToAdd: [computedImportString],
          })
        );
      } else {
        fixes.push(
          fixer.insertTextAfter(
            importNode,
            `\nimport { ${computedImportString} } from "@ember/object";`
          )
        );
      }
    }
  }

  return fixes;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Convert @discourseComputed decorators to native Ember @computed",
    },
    fixable: "code",
    schema: [], // no options
    messages: {
      replaceImport:
        'Use `import { computed } from "@ember/object";` instead of `import discourseComputed from "discourse/lib/decorators";`.',
      replaceDecorator:
        "Use '@computed(...)' instead of '@discourseComputed(...)'.",
      cannotAutoFixClassic:
        "Cannot auto-fix {{name}} in classic Ember classes. Please convert to native ES6 class first.",
      cannotAutoFixNestedFunction:
        "Cannot auto-fix @{{name}} because parameter '{{param}}' is used inside a nested function. Inside nested regular functions (not arrow functions), 'this' refers to a different context, so converting '{{param}}' to 'this.{{propertyPath}}' would be incorrect. Convert to getter manually.",
      cannotAutoFixUnsafeOptionalChaining:
        "Cannot auto-fix @{{name}} because parameter '{{param}}' with nested property path '{{propertyPath}}' would create unsafe optional chaining. Convert to getter manually and handle the chaining explicitly.",
      cannotAutoFixUpdateExpression:
        "Cannot auto-fix @{{name}} because parameter '{{param}}' uses update expressions (++/--). Convert to getter manually and use a local variable with explicit assignment.",
      cannotAutoFixNestedReassignment:
        "Cannot auto-fix @{{name}} because parameter '{{param}}' is reassigned inside a nested block (if/loop/etc). Convert to getter manually.",
      cannotAutoFixSpread:
        "Cannot auto-fix @{{name}} because parameter '{{param}}' is used in a spread operator. Example: Use '...(this.{{propertyPath}} || [])' or '...(this.{{propertyPath}} ?? [])' for safe spreading.",
      cannotAutoFixGeneric:
        "Cannot auto-fix @{{name}} because parameter '{{param}}' has complex reassignment patterns. Convert to getter manually and use a local variable.",
    },
  },

  create(context) {
    const sourceCode = context.getSourceCode();
    let hasComputedImport = false;
    let emberObjectImportNode = null;
    let discourseComputedInfo = null; // Cache info about discourseComputed decorators
    let discourseComputedLocalName = null; // Track the local name used for discourseComputed import
    let computedImportName = null; // Track what name to use for computed from @ember/object
    let importsAnalyzed = false; // Track if we've scanned all imports

    // We now use utilities in ./utils to keep this file focused on the rule logic.

    // Wrapper that uses the generic helpers to populate rule-specific import state.
    // We intentionally compute the specific values here (instead of in the utils
    // module) so `utils/analyze-imports.mjs` remains generic and reusable.
    function analyzeAllDiscourseComputedImports() {
      if (importsAnalyzed) {
        return;
      }

      const imports = collectImports(sourceCode);
      const allImportedIdentifiers = getImportedLocalNames(sourceCode);

      // @ember/object import
      const emberNode = imports.get("@ember/object");
      if (emberNode) {
        emberObjectImportNode = emberNode.node;
        const computedSpecifier = emberNode.specifiers.find(
          (spec) =>
            spec.type === "ImportSpecifier" &&
            spec.imported &&
            spec.imported.name === "computed"
        );
        if (computedSpecifier) {
          hasComputedImport = true;
          computedImportName = computedSpecifier.local.name;
        }
      }

      // discourse default import
      const discourseNode = imports.get("discourse/lib/decorators");
      if (discourseNode) {
        const defaultSpecifier = discourseNode.specifiers.find(
          (spec) => spec.type === "ImportDefaultSpecifier"
        );
        if (defaultSpecifier) {
          discourseComputedLocalName = defaultSpecifier.local.name;
        }
      }

      if (!computedImportName) {
        const isComputedUsedElsewhere =
          allImportedIdentifiers.has("computed") &&
          discourseComputedLocalName !== "computed";
        computedImportName = isComputedUsedElsewhere
          ? "emberComputed"
          : "computed";
      }

      importsAnalyzed = true;
    }

    function analyzeDiscourseComputedUsage() {
      if (discourseComputedInfo !== null) {
        return discourseComputedInfo;
      }
      // Delegate to the reusable analyzer; keep result cached locally
      discourseComputedInfo = analyzeDiscourseComputedUsageUtil(
        sourceCode,
        discourseComputedLocalName
      );
      return discourseComputedInfo;
    }

    return {
      ImportDeclaration(node) {
        // Analyze all imports first to avoid race conditions
        analyzeAllDiscourseComputedImports();

        // Handle import from "discourse/lib/decorators"
        // The default export is discourseComputed, but it could be imported with any name
        if (node.source.value === "discourse/lib/decorators") {
          const defaultSpecifier = node.specifiers.find(
            (spec) => spec.type === "ImportDefaultSpecifier"
          );

          if (defaultSpecifier) {
            const usageInfo = analyzeDiscourseComputedUsage();

            context.report({
              node: defaultSpecifier,
              messageId: "replaceImport",
              fix: (fixer) =>
                fixDiscourseImport(
                  fixer,
                  node,
                  usageInfo,
                  sourceCode,
                  hasComputedImport,
                  emberObjectImportNode,
                  computedImportName,
                  discourseComputedLocalName
                ),
            });
          }
        }
      },

      CallExpression(node) {
        const { usageMap } = analyzeDiscourseComputedUsage();
        const usage = usageMap.get(node);
        if (usage) {
          context.report({
            node,
            messageId: usage.messageId,
            data: usage.reportData,
          });
        }
      },

      Property: function (node) {
        const { usageMap } = analyzeDiscourseComputedUsage();
        const discourseDecorator = (node.decorators || []).find((decorator) =>
          usageMap.has(decorator)
        );

        if (discourseDecorator) {
          const usage = usageMap.get(discourseDecorator);
          context.report({
            node: discourseDecorator,
            messageId: usage.messageId,
            data: usage.reportData,
          });
        }
      },

      MethodDefinition: function (node) {
        if (!node.decorators || node.decorators.length === 0) {
          return;
        }

        const { usageMap, hasParameterReassignments } =
          analyzeDiscourseComputedUsage();
        const discourseComputedDecorator = node.decorators.find((decorator) =>
          usageMap.has(decorator)
        );

        if (!discourseComputedDecorator) {
          return;
        }

        const usage = usageMap.get(discourseComputedDecorator);
        const { canAutoFix, messageId, reportData, simpleReassignments } =
          usage;

        // Determine if we need to rename non-fixable decorators
        // This happens when: import was originally named 'computed', we're keeping it (mixed scenario),
        // and we renamed it to 'discourseComputed'
        const needsDecoratorRename =
          !canAutoFix &&
          hasParameterReassignments &&
          discourseComputedLocalName === "computed";

        const decoratorExpression = discourseComputedDecorator.expression;
        let decoratorArgs = [];
        if (decoratorExpression.type === "CallExpression") {
          decoratorArgs = decoratorExpression.arguments
            .map((arg) => (arg.type === "Literal" ? arg.value : null))
            .filter(Boolean);
        }

        context.report({
          node: discourseComputedDecorator,
          messageId: messageId || "replaceDecorator",
          data: reportData,
          fix: !canAutoFix
            ? needsDecoratorRename
              ? function (fixer) {
                  // Just rename the decorator to match the renamed import
                  if (decoratorExpression.type === "CallExpression") {
                    return fixer.replaceText(
                      decoratorExpression.callee,
                      "discourseComputed"
                    );
                  } else {
                    return fixer.replaceText(
                      decoratorExpression,
                      "discourseComputed"
                    );
                  }
                }
              : undefined
            : createMethodFix(
                sourceCode,
                node,
                decoratorArgs,
                computedImportName,
                { simpleReassignments }
              ),
        });
      },
    };
  },
};
