import { analyzeDiscourseComputedUsage as analyzeDiscourseComputedUsageUtil } from "./no-discourse-computed/discourse-computed-analysis.mjs";
import { createMethodFix } from "./no-discourse-computed/discourse-computed-fixer.mjs";
import {
  collectImports,
  getImportedLocalNames,
} from "./utils/analyze-imports.mjs";
import { fixImport } from "./utils/fix-import.mjs";

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
            // Analyze all @discourseComputed usage in the file using AST
            const {
              hasFixableDecorators,
              hasClassicClassDecorators,
              hasParameterReassignments,
              hasParametersInSpread,
              hasUnsafeOptionalChaining,
              hasParameterInNestedFunction,
            } = analyzeDiscourseComputedUsage();

            context.report({
              node: defaultSpecifier,
              messageId: "replaceImport",
              fix: function (fixer) {
                const fixes = [];
                const importNode = node; // Reference to the full ImportDeclaration

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

                // If there are classic class decorators, parameter reassignments, parameters in spread, unsafe optional chaining, or parameters in nested functions,
                // we keep the discourseComputed import. Otherwise, we remove it
                if (
                  !hasClassicClassDecorators &&
                  !hasParameterReassignments &&
                  !hasParametersInSpread &&
                  !hasUnsafeOptionalChaining &&
                  !hasParameterInNestedFunction
                ) {
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
                        // Add computed to existing @ember/object import
                        fixes.push(
                          fixImport(fixer, emberObjectImportNode, {
                            namedImportsToAdd: [computedImportString],
                          })
                        );
                      } else {
                        // Create new @ember/object import after the modified import
                        fixes.push(
                          fixer.insertTextAfter(
                            importNode,
                            `\nimport { ${computedImportString} } from "@ember/object";`
                          )
                        );
                      }
                    }
                  } else {
                    // No named imports, handle entire import line
                    if (!hasComputedImport) {
                      if (emberObjectImportNode) {
                        // Remove discourseComputed import, add computed to @ember/object
                        const nextChar = sourceCode
                          .getText()
                          .charAt(importNode.range[1]);
                        const rangeEnd =
                          nextChar === "\n"
                            ? importNode.range[1] + 1
                            : importNode.range[1];
                        fixes.push(
                          fixer.removeRange([importNode.range[0], rangeEnd])
                        );

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
                      const nextChar = sourceCode
                        .getText()
                        .charAt(importNode.range[1]);
                      const rangeEnd =
                        nextChar === "\n"
                          ? importNode.range[1] + 1
                          : importNode.range[1];
                      fixes.push(
                        fixer.removeRange([importNode.range[0], rangeEnd])
                      );
                    }
                  }
                } else {
                  // Has classic class decorators or parameter reassignments, but also has fixable decorators
                  // Keep discourseComputed import but add computed for the fixable ones

                  // If the default import is named 'computed', rename it to 'discourseComputed'
                  if (discourseComputedLocalName === "computed") {
                    // fixImport doesn't support renaming, so we need to manually construct
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

                    fixes.push(
                      fixer.replaceText(importNode, newImportStatement)
                    );
                  }

                  if (!hasComputedImport) {
                    if (emberObjectImportNode) {
                      // Add computed to existing @ember/object import
                      fixes.push(
                        fixImport(fixer, emberObjectImportNode, {
                          namedImportsToAdd: [computedImportString],
                        })
                      );
                    } else {
                      // Create new @ember/object import after the discourseComputed import
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
              },
            });
          }
        }
      },

      CallExpression(node) {
        // Check if this is a discourseComputed function call (using the tracked local name)
        if (node.callee && node.callee.name === discourseComputedLocalName) {
          // Skip if this CallExpression is part of a decorator - those are handled by the Property/MethodDefinition handlers
          if (node.parent && node.parent.type === "Decorator") {
            return;
          }

          // Check if we're inside a .extend() call (classic class)
          let parent = node.parent;
          let isClassicClass = false;

          // Traverse up to check if this is inside a .extend() call
          while (parent) {
            if (
              parent.type === "CallExpression" &&
              parent.callee &&
              parent.callee.type === "MemberExpression" &&
              parent.callee.property &&
              parent.callee.property.name === "extend"
            ) {
              isClassicClass = true;
              break;
            }
            parent = parent.parent;
          }

          if (isClassicClass) {
            context.report({
              node,
              messageId: "cannotAutoFixClassic",
              data: { name: discourseComputedLocalName },
            });
          }
        }
      },

      Property: function (node) {
        // Handle classic Ember classes with decorator syntax (e.g., Component.extend({ @discourseComputed ... }))
        if (!node.decorators || node.decorators.length === 0) {
          return;
        }

        // Check if this property is a method in a classic class
        if (node.value && node.value.type === "FunctionExpression") {
          // Find decorator using the tracked local name
          const discourseComputedDecorator = node.decorators.find(
            (decorator) => {
              if (decorator.expression.type === "CallExpression") {
                return (
                  decorator.expression.callee.name ===
                  discourseComputedLocalName
                );
              }
              return decorator.expression.name === discourseComputedLocalName;
            }
          );

          if (discourseComputedDecorator) {
            // Check if we're inside a .extend() call (classic class)
            let parent = node.parent;
            let isClassicClass = false;

            // Traverse up to check if this is inside a .extend() call
            while (parent) {
              if (
                parent.type === "CallExpression" &&
                parent.callee &&
                parent.callee.type === "MemberExpression" &&
                parent.callee.property &&
                parent.callee.property.name === "extend"
              ) {
                isClassicClass = true;
                break;
              }
              parent = parent.parent;
            }

            if (isClassicClass) {
              context.report({
                node: discourseComputedDecorator,
                messageId: "cannotAutoFixClassic",
                data: { name: `@${discourseComputedLocalName}` },
              });
            }
          }
        }
      },

      MethodDefinition: function (node) {
        if (!node.decorators || node.decorators.length === 0) {
          return;
        }

        // Find decorator using the tracked local name
        const discourseComputedDecorator = node.decorators.find((decorator) => {
          if (decorator.expression.type === "CallExpression") {
            return (
              decorator.expression.callee.name === discourseComputedLocalName
            );
          }
          return decorator.expression.name === discourseComputedLocalName;
        });

        if (!discourseComputedDecorator) {
          return;
        }

        // Get decorator arguments
        const decoratorExpression = discourseComputedDecorator.expression;
        let decoratorArgs = [];
        if (decoratorExpression.type === "CallExpression") {
          decoratorArgs = decoratorExpression.arguments
            .map((arg) => {
              if (arg.type === "Literal") {
                return arg.value;
              }
              return null;
            })
            .filter(Boolean);
        }

        // Check if any parameters are reassigned in the method body
        const paramNames = node.value.params.map((param) => param.name);
        let hasParameterInSpread = false;
        let hasUnsafeOptionalChaining = false;
        let hasParameterInNestedFunction = false;
        let nestedFunctionParam = null;
        let spreadParam = null;
        let unsafeOptionalChainingParam = null;
        const parameterReassignmentInfo = {}; // Track detailed info per parameter

        if (paramNames.length > 0) {
          const checkForReassignmentOrSpread = (
            astNode,
            depth = 0,
            inNestedFunction = false
          ) => {
            if (!astNode || typeof astNode !== "object") {
              return;
            }

            // Check if we're entering a nested regular function (not arrow function)
            // In nested functions, 'this' has a different context, so we can't safely convert parameter references to this.property
            const isNestedFunction =
              (astNode.type === "FunctionExpression" ||
                astNode.type === "FunctionDeclaration") &&
              inNestedFunction === false;
            const newInNestedFunction = inNestedFunction || isNestedFunction;

            // Check if a parameter is used inside a nested regular function
            if (
              newInNestedFunction &&
              astNode.type === "Identifier" &&
              paramNames.includes(astNode.name)
            ) {
              // Skip if this Identifier is the function name itself (for named function expressions)
              const parent = astNode.parent;
              if (
                !(
                  parent &&
                  parent.type === "FunctionExpression" &&
                  parent.id === astNode
                )
              ) {
                hasParameterInNestedFunction = true;
                nestedFunctionParam = astNode.name;
              }
            }

            // Check for parameters with nested properties used in logical/conditional expressions
            // that are then used as object in MemberExpression
            // UNSAFE: (this.item?.username || this.item?.draft_username).toLowerCase() - both could be undefined
            // SAFE: (this.siteSettings?.value || "default").split() - literal fallback is safe
            if (astNode.type === "MemberExpression" && astNode.object) {
              // Only check if the object is a logical or conditional expression (NOT binary arithmetic)
              if (
                astNode.object.type === "LogicalExpression" ||
                astNode.object.type === "ConditionalExpression"
              ) {
                // Check if the expression has a safe literal fallback
                const hasSafeLiteralFallback = (expr) => {
                  if (expr.type === "LogicalExpression") {
                    // For || and ??, the right side is the fallback
                    if (expr.operator === "||" || expr.operator === "??") {
                      // Check if right side is a literal (string, number, boolean, null)
                      return expr.right.type === "Literal";
                    }
                    // For &&, both sides matter - not a safe pattern for fallback
                    return false;
                  }
                  // ConditionalExpression would need both consequent and alternate to be safe
                  return false;
                };

                // Skip unsafe check if there's a safe literal fallback
                if (hasSafeLiteralFallback(astNode.object)) {
                  return;
                }

                const checkForNestedPropertiesInExpression = (childNode) => {
                  if (!childNode || typeof childNode !== "object") {
                    return false;
                  }

                  // Check if it's a parameter identifier with nested properties
                  if (
                    childNode.type === "Identifier" &&
                    paramNames.includes(childNode.name)
                  ) {
                    const paramIndex = paramNames.indexOf(childNode.name);
                    const propertyPath =
                      decoratorArgs[paramIndex] || childNode.name;
                    // Check if it's a nested property (contains a dot)
                    if (
                      propertyPath.includes(".") ||
                      propertyPath.includes("{") ||
                      propertyPath.includes("@") ||
                      propertyPath.includes("[")
                    ) {
                      hasUnsafeOptionalChaining = true;
                      unsafeOptionalChainingParam = childNode.name;
                      return true;
                    }
                  }

                  // Recursively check in nested expressions
                  if (
                    childNode.type === "LogicalExpression" ||
                    childNode.type === "ConditionalExpression"
                  ) {
                    return (
                      checkForNestedPropertiesInExpression(childNode.left) ||
                      checkForNestedPropertiesInExpression(childNode.right) ||
                      (childNode.alternate &&
                        checkForNestedPropertiesInExpression(
                          childNode.alternate
                        ))
                    );
                  }

                  return false;
                };

                checkForNestedPropertiesInExpression(astNode.object);
              }
            }

            // Check for assignment to a parameter
            if (
              astNode.type === "AssignmentExpression" &&
              astNode.left &&
              astNode.left.type === "Identifier" &&
              paramNames.includes(astNode.left.name)
            ) {
              const paramName = astNode.left.name;
              if (!parameterReassignmentInfo[paramName]) {
                parameterReassignmentInfo[paramName] = {
                  assignments: [],
                  hasUpdateExpression: false,
                };
              }
              parameterReassignmentInfo[paramName].assignments.push({
                node: astNode,
                depth,
              });
              return;
            }

            // Check for update expressions (++, --) - these can't be auto-fixed
            if (
              astNode.type === "UpdateExpression" &&
              astNode.argument &&
              astNode.argument.type === "Identifier" &&
              paramNames.includes(astNode.argument.name)
            ) {
              const paramName = astNode.argument.name;
              if (!parameterReassignmentInfo[paramName]) {
                parameterReassignmentInfo[paramName] = {
                  assignments: [],
                  hasUpdateExpression: false,
                };
              }
              parameterReassignmentInfo[paramName].hasUpdateExpression = true;
              return;
            }

            // Check for spread elements containing parameters or their properties
            if (astNode.type === "SpreadElement") {
              const isSafeArrayFallback = (childNode) => {
                // Check if node is an array literal or array expression
                return childNode?.type === "ArrayExpression";
              };

              const checkSpreadArgument = (
                childNode,
                isTopLevel = true,
                isInSafeContext = false
              ) => {
                if (!childNode) {
                  return;
                }

                // At the top level, check for safe fallback patterns first
                if (isTopLevel) {
                  // Safe pattern: ...(param || []) or ...(param ?? [])
                  if (
                    childNode.type === "LogicalExpression" &&
                    (childNode.operator === "||" ||
                      childNode.operator === "??") &&
                    isSafeArrayFallback(childNode.right)
                  ) {
                    // This is a safe pattern, don't mark as unsafe
                    // We can safely skip this - parameters will be replaced normally in the body
                    return;
                  }

                  // Safe pattern: ...(condition ? param : []) or similar with safe alternate
                  if (
                    childNode.type === "ConditionalExpression" &&
                    isSafeArrayFallback(childNode.alternate)
                  ) {
                    // This is a safe pattern, don't mark as unsafe
                    // We can safely skip this - parameters will be replaced normally in the body
                    return;
                  }
                }

                // Direct parameter: ...param
                if (
                  childNode.type === "Identifier" &&
                  paramNames.includes(childNode.name)
                ) {
                  if (!isInSafeContext) {
                    hasParameterInSpread = true;
                  }
                  return;
                }

                // Member expression: ...param.property
                if (childNode.type === "MemberExpression") {
                  let obj = childNode.object;
                  while (obj) {
                    if (
                      obj.type === "Identifier" &&
                      paramNames.includes(obj.name)
                    ) {
                      if (!isInSafeContext) {
                        hasParameterInSpread = true;
                      }
                      return;
                    }
                    if (obj.type === "MemberExpression") {
                      obj = obj.object;
                    } else {
                      break;
                    }
                  }
                }

                // Check inside parenthesized expressions
                if (childNode.type === "ParenthesizedExpression") {
                  checkSpreadArgument(
                    childNode.expression,
                    isTopLevel,
                    isInSafeContext
                  );
                  return;
                }

                // For nested contexts (not at top level), recursively check
                if (!isTopLevel) {
                  if (childNode.type === "LogicalExpression") {
                    checkSpreadArgument(childNode.left, false, isInSafeContext);
                    checkSpreadArgument(
                      childNode.right,
                      false,
                      isInSafeContext
                    );
                  }

                  if (childNode.type === "ConditionalExpression") {
                    checkSpreadArgument(childNode.test, false, isInSafeContext);
                    checkSpreadArgument(
                      childNode.consequent,
                      false,
                      isInSafeContext
                    );
                    checkSpreadArgument(
                      childNode.alternate,
                      false,
                      isInSafeContext
                    );
                  }
                }
              };

              checkSpreadArgument(astNode.argument);
            }

            // Track depth for nested structures
            // Only increment depth for actual control flow structures, not function bodies
            const isNestingNode =
              astNode.type === "IfStatement" ||
              astNode.type === "ForStatement" ||
              astNode.type === "WhileStatement" ||
              astNode.type === "DoWhileStatement" ||
              astNode.type === "SwitchStatement" ||
              astNode.type === "TryStatement";

            // Recursively check children
            for (const key in astNode) {
              if (key === "parent" || key === "range" || key === "loc") {
                continue;
              }
              const child = astNode[key];
              const childDepth = isNestingNode ? depth + 1 : depth;
              if (Array.isArray(child)) {
                child.forEach((item) =>
                  checkForReassignmentOrSpread(
                    item,
                    childDepth,
                    newInNestedFunction
                  )
                );
              } else {
                checkForReassignmentOrSpread(
                  child,
                  childDepth,
                  newInNestedFunction
                );
              }
            }
          };

          checkForReassignmentOrSpread(node.value.body, 0, false);
        }

        const hasParameterReassignment =
          Object.keys(parameterReassignmentInfo).length > 0;

        // Check for "simple" reassignment cases we can auto-fix:
        // - Consecutive statements at the beginning are ExpressionStatement with AssignmentExpression
        // - No update expressions
        // - Assignments are at depth 0 (not nested in if/loop/etc)
        const simpleReassignments = [];

        if (
          hasParameterReassignment &&
          !hasParameterInSpread &&
          node.value.body.body &&
          node.value.body.body.length > 0
        ) {
          // Check consecutive statements from the beginning
          for (let i = 0; i < node.value.body.body.length; i++) {
            const statement = node.value.body.body[i];

            if (
              statement.type === "ExpressionStatement" &&
              statement.expression.type === "AssignmentExpression" &&
              statement.expression.left.type === "Identifier" &&
              paramNames.includes(statement.expression.left.name)
            ) {
              const paramName = statement.expression.left.name;
              const paramInfo = parameterReassignmentInfo[paramName];

              // Check if this parameter has update expressions
              if (paramInfo && !paramInfo.hasUpdateExpression) {
                // Check if the first assignment is at depth 0
                const firstAssignment = paramInfo.assignments[0];
                if (
                  firstAssignment &&
                  firstAssignment.depth === 0 &&
                  firstAssignment.node === statement.expression
                ) {
                  simpleReassignments.push({
                    statement,
                    paramName,
                    info: paramInfo,
                  });
                  continue; // Continue checking next statement
                }
              }
            }

            // If we hit a non-simple-reassignment statement, stop checking
            break;
          }
        }

        const hasSimpleReassignments = simpleReassignments.length > 0;

        // Check if we need to rename non-fixable decorators
        // This happens when: import was originally named 'computed', we're keeping it (mixed scenario),
        // and we renamed it to 'discourseComputed'
        const { hasParameterReassignments } = analyzeDiscourseComputedUsage();

        // Determine if we can auto-fix or need to provide error message
        const canAutoFix =
          !hasUnsafeOptionalChaining &&
          !hasParameterInNestedFunction &&
          (hasSimpleReassignments ||
            (!hasParameterReassignment && !hasParameterInSpread));
        const needsDecoratorRename =
          !canAutoFix &&
          hasParameterReassignments &&
          discourseComputedLocalName === "computed";

        // Choose a specific messageId and data parameters. Messages are defined in meta.messages and use parameter replacement.
        let messageIdToUse;
        const reportData = { name: discourseComputedLocalName };

        if (canAutoFix) {
          // For fixable decorators, use the replace message
          messageIdToUse = "replaceDecorator";
        } else if (hasParameterInNestedFunction) {
          messageIdToUse = "cannotAutoFixNestedFunction";
          reportData.param = nestedFunctionParam;
          reportData.propertyPath =
            decoratorArgs[paramNames.indexOf(nestedFunctionParam)] ||
            nestedFunctionParam;
        } else if (hasUnsafeOptionalChaining) {
          messageIdToUse = "cannotAutoFixUnsafeOptionalChaining";
          reportData.param = unsafeOptionalChainingParam;
          reportData.propertyPath =
            decoratorArgs[paramNames.indexOf(unsafeOptionalChainingParam)] ||
            unsafeOptionalChainingParam;
        } else if (hasParameterReassignment && !hasSimpleReassignments) {
          const reassignedParam = Object.keys(parameterReassignmentInfo)[0];
          const reassignedInfo =
            parameterReassignmentInfo[reassignedParam] || {};
          reportData.param = reassignedParam;
          reportData.propertyPath =
            decoratorArgs[paramNames.indexOf(reassignedParam)] ||
            reassignedParam;

          if (reassignedInfo.hasUpdateExpression) {
            messageIdToUse = "cannotAutoFixUpdateExpression";
          } else if (
            reassignedInfo.assignments &&
            reassignedInfo.assignments.length > 0 &&
            reassignedInfo.assignments[0].depth > 0
          ) {
            messageIdToUse = "cannotAutoFixNestedReassignment";
          } else {
            messageIdToUse = "cannotAutoFixGeneric";
          }
        } else if (hasParameterInSpread) {
          messageIdToUse = "cannotAutoFixSpread";
          reportData.param = spreadParam;
          reportData.propertyPath =
            decoratorArgs[paramNames.indexOf(spreadParam)] || spreadParam;
        } else {
          // Fallback generic message
          messageIdToUse = "cannotAutoFixGeneric";
          reportData.param = paramNames[0] || "";
          reportData.propertyPath = decoratorArgs[0] || reportData.param;
        }

        context.report({
          node: discourseComputedDecorator,
          messageId: messageIdToUse,
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
