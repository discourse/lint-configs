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
  },

  create(context) {
    const sourceCode = context.getSourceCode();
    let hasComputedImport = false;
    let emberObjectImportNode = null;
    let discourseComputedInfo = null; // Cache info about discourseComputed decorators
    let discourseComputedLocalName = null; // Track the local name used for discourseComputed import
    let discourseComputedImportNode = null; // Track the discourse/lib/decorators import node
    let computedImportName = null; // Track what name to use for computed from @ember/object
    let importsAnalyzed = false; // Track if we've scanned all imports

    // Helper function to extract the clean attribute path before special tokens
    function niceAttr(attr) {
      const parts = attr.split(".");
      let i;

      for (i = 0; i < parts.length; i++) {
        if (parts[i] === "@each" || parts[i] === "[]" || parts[i].includes("{")) {
          break;
        }
      }

      return parts.slice(0, i).join(".");
    }

    // Helper function to convert property path to optional chaining with this
    // e.g., "model.poll.title" -> "this.model?.poll?.title" (with optional chaining)
    // e.g., "model.poll.title" -> "this.model.poll.title" (without optional chaining, when unsafe)
    // e.g., "data.0.value" -> "this.data?.[0]?.value"
    // e.g., "items.@each.value" with member access -> "this.items" (for use with optional chaining in member expression)
    // useOptionalChaining: if true, uses optional chaining for nested properties; false for contexts where it's unsafe (e.g., spread operator)
    // needsTrailingChaining: if true and path was extracted, indicates this will be used with member expression and should add trailing ?.
    function propertyPathToOptionalChaining(propertyPath, useOptionalChaining = true, needsTrailingChaining = false) {
      // First, apply niceAttr to handle @each, [], and {} cases
      const cleanPath = niceAttr(propertyPath);
      const wasExtracted = cleanPath !== propertyPath;

      if (!cleanPath) {
        return "this";
      }

      const parts = cleanPath.split(".");
      let result = "this";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // Check if this part is a numeric index
        if (/^\d+$/.test(part)) {
          // Use bracket notation for numeric indices
          if (useOptionalChaining) {
            result += `?.[${part}]`;
          } else {
            result += `[${part}]`;
          }
        } else {
          // First property uses . (since this is always defined)
          // Subsequent properties use ?. for optional chaining (if enabled)
          if (i === 0) {
            result += `.${part}`;
          } else {
            result += useOptionalChaining ? `?.${part}` : `.${part}`;
          }
        }
      }

      // If this was extracted from @each/[] and will be used in a member expression, add trailing ?.
      // This allows the next property access to complete the optional chain (e.g., "this.items?." + "length" = "this.items?.length")
      if (wasExtracted && parts.length === 1 && needsTrailingChaining && useOptionalChaining) {
        result += "?.";
      }

      return result;
    }

    // Helper function to scan all imports in the file
    function analyzeAllImports() {
      if (importsAnalyzed) {
        return;
      }

      const allImportedIdentifiers = new Set();

      sourceCode.ast.body.forEach(statement => {
        if (statement.type !== 'ImportDeclaration') {
          return;
        }

        // Collect all imported identifiers
        statement.specifiers.forEach(spec => {
          allImportedIdentifiers.add(spec.local.name);
        });

        // Check for @ember/object import with computed
        if (statement.source.value === "@ember/object") {
          emberObjectImportNode = statement;
          const computedSpecifier = statement.specifiers.find(
            (spec) =>
              spec.type === "ImportSpecifier" &&
              spec.imported.name === "computed"
          );
          if (computedSpecifier) {
            hasComputedImport = true;
            computedImportName = computedSpecifier.local.name; // Store the aliased name
          }
        }

        // Check for discourse/lib/decorators default import
        if (statement.source.value === "discourse/lib/decorators") {
          discourseComputedImportNode = statement;
          const defaultSpecifier = statement.specifiers.find(
            (spec) => spec.type === "ImportDefaultSpecifier"
          );
          if (defaultSpecifier) {
            discourseComputedLocalName = defaultSpecifier.local.name;
          }
        }
      });

      // Determine what name to use for computed import from @ember/object
      if (!computedImportName) {
        // computed is not yet imported from @ember/object
        // Check if 'computed' identifier is already used by something OTHER than discourse import
        // If discourseComputedLocalName === 'computed', we'll rename it to 'discourseComputed', so 'computed' will be free
        const isComputedUsedElsewhere = allImportedIdentifiers.has('computed') && discourseComputedLocalName !== 'computed';

        if (isComputedUsedElsewhere) {
          // 'computed' is used by something else, we'll need an alias
          computedImportName = 'emberComputed';
        } else {
          computedImportName = 'computed';
        }
      }

      importsAnalyzed = true;
    }

    // Helper function to scan all discourseComputed decorators in the file
    function analyzeDiscourseComputedUsage() {
      if (discourseComputedInfo !== null) {
        return discourseComputedInfo;
      }

      const info = {
        hasFixableDecorators: false,
        hasClassicClassDecorators: false,
        hasParameterReassignments: false,
        hasParametersInSpread: false,
      };

      // Helper to traverse any node recursively
      function traverseNode(node) {
        if (!node || typeof node !== 'object') {
          return;
        }

        // Check ES6 class declarations
        if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
          analyzeClassBody(node.body, info);
        }

        // Check for classic Ember classes (e.g., Component.extend({ ... }))
        if (node.type === 'CallExpression' &&
            node.callee &&
            node.callee.type === 'MemberExpression' &&
            node.callee.property &&
            node.callee.property.name === 'extend') {
          // This is a .extend() call - check its arguments for decorated properties
          node.arguments.forEach(arg => {
            if (arg.type === 'ObjectExpression') {
              analyzeObjectExpression(arg, info);
            }
          });
        }

        // Recursively traverse all child nodes
        for (const key in node) {
          if (key === 'parent' || key === 'range' || key === 'loc') {
            continue;
          }
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach(item => traverseNode(item));
          } else {
            traverseNode(child);
          }
        }
      }

      // Traverse the AST starting from the body
      sourceCode.ast.body.forEach(statement => traverseNode(statement));

      discourseComputedInfo = info;
      return info;
    }

    function analyzeClassBody(classBody, info) {
      if (!classBody || !classBody.body) {
        return;
      }

      classBody.body.forEach(member => {
        if (member.type !== 'MethodDefinition' || !member.decorators) {
          return;
        }

        // Check if this method has @discourseComputed decorator (using the tracked local name)
        const discourseDecorator = member.decorators.find(decorator => {
          if (decorator.expression.type === 'CallExpression') {
            return decorator.expression.callee.name === discourseComputedLocalName;
          }
          return decorator.expression.name === discourseComputedLocalName;
        });

        if (discourseDecorator) {
          // Check if any parameters are reassigned or used in spread
          const paramNames = member.value.params.map((param) => param.name);
          let hasParameterReassignment = false;
          let hasParameterInSpread = false;

          if (paramNames.length > 0) {
            const checkForReassignmentOrSpread = (astNode) => {
              if (!astNode || typeof astNode !== 'object') {
                return;
              }

              // Check for assignment to a parameter
              if (astNode.type === 'AssignmentExpression' &&
                  astNode.left &&
                  astNode.left.type === 'Identifier' &&
                  paramNames.includes(astNode.left.name)) {
                hasParameterReassignment = true;
                return;
              }

              // Check for update expressions (++, --)
              if (astNode.type === 'UpdateExpression' &&
                  astNode.argument &&
                  astNode.argument.type === 'Identifier' &&
                  paramNames.includes(astNode.argument.name)) {
                hasParameterReassignment = true;
                return;
              }

              // Check for spread elements containing parameters
              if (astNode.type === 'SpreadElement') {
                const checkSpreadArgument = (node) => {
                  if (!node) return;

                  if (node.type === 'Identifier' && paramNames.includes(node.name)) {
                    hasParameterInSpread = true;
                    return;
                  }

                  if (node.type === 'MemberExpression') {
                    let obj = node.object;
                    while (obj) {
                      if (obj.type === 'Identifier' && paramNames.includes(obj.name)) {
                        hasParameterInSpread = true;
                        return;
                      }
                      if (obj.type === 'MemberExpression') {
                        obj = obj.object;
                      } else {
                        break;
                      }
                    }
                  }
                };

                checkSpreadArgument(astNode.argument);
              }

              // Recursively check children
              for (const key in astNode) {
                if (key === 'parent' || key === 'range' || key === 'loc') {
                  continue;
                }
                const child = astNode[key];
                if (Array.isArray(child)) {
                  child.forEach(item => checkForReassignmentOrSpread(item));
                } else {
                  checkForReassignmentOrSpread(child);
                }
              }
            };

            checkForReassignmentOrSpread(member.value.body);
          }

          if (hasParameterReassignment) {
            info.hasParameterReassignments = true;
          } else if (hasParameterInSpread) {
            info.hasParametersInSpread = true;
          } else {
            info.hasFixableDecorators = true;
          }
        }
      });
    }

    function analyzeObjectExpression(objExpr, info) {
      if (!objExpr || !objExpr.properties) {
        return;
      }

      objExpr.properties.forEach(prop => {
        // Check if this property has decorators (classic class with decorator syntax)
        if (prop.type === 'Property' && prop.decorators && prop.decorators.length > 0) {
          const discourseDecorator = prop.decorators.find(decorator => {
            if (decorator.expression.type === 'CallExpression') {
              return decorator.expression.callee.name === discourseComputedLocalName;
            }
            return decorator.expression.name === discourseComputedLocalName;
          });

          if (discourseDecorator) {
            // Classic classes with decorators cannot be auto-fixed
            info.hasClassicClassDecorators = true;
          }
        }

        // Check if this property uses discourseComputed as a function call
        // e.g., { text: discourseComputed("name", function(name) { ... }) }
        if (prop.type === 'Property' &&
            prop.value &&
            prop.value.type === 'CallExpression' &&
            prop.value.callee &&
            prop.value.callee.name === discourseComputedLocalName) {
          // Classic classes with discourseComputed function calls cannot be auto-fixed
          info.hasClassicClassDecorators = true;
        }
      });
    }

    return {
      ImportDeclaration(node) {
        // Analyze all imports first to avoid race conditions
        analyzeAllImports();

        // Handle import from "discourse/lib/decorators"
        // The default export is discourseComputed, but it could be imported with any name
        if (node.source.value === "discourse/lib/decorators") {
          const defaultSpecifier = node.specifiers.find(
            (spec) => spec.type === "ImportDefaultSpecifier"
          );

          if (defaultSpecifier) {
            // Analyze all @discourseComputed usage in the file using AST
            const { hasFixableDecorators, hasClassicClassDecorators, hasParameterReassignments, hasParametersInSpread } = analyzeDiscourseComputedUsage();

            context.report({
              node: defaultSpecifier,
              message:
                'Use \'import { computed } from "@ember/object";\' instead of \'import discourseComputed from "discourse/lib/decorators";\'.',
              fix: function(fixer) {
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
                const computedImportString = computedImportName === 'computed'
                  ? 'computed'
                  : `computed as ${computedImportName}`;

                // If there are classic class decorators, parameter reassignments, or parameters in spread,
                // we keep the discourseComputed import. Otherwise, we remove it
                if (!hasClassicClassDecorators && !hasParameterReassignments && !hasParametersInSpread) {
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
                        const nextChar = sourceCode.getText().charAt(importNode.range[1]);
                        const rangeEnd = nextChar === '\n' ? importNode.range[1] + 1 : importNode.range[1];
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
                      const rangeEnd = nextChar === '\n' ? importNode.range[1] + 1 : importNode.range[1];
                      fixes.push(fixer.removeRange([importNode.range[0], rangeEnd]));
                    }
                  }
                } else {
                  // Has classic class decorators or parameter reassignments, but also has fixable decorators
                  // Keep discourseComputed import but add computed for the fixable ones

                  // If the default import is named 'computed', rename it to 'discourseComputed'
                  if (discourseComputedLocalName === 'computed') {
                    // fixImport doesn't support renaming, so we need to manually construct
                    const namedImportStrings = namedSpecifiers.map(spec => {
                      if (spec.imported.name === spec.local.name) {
                        return spec.imported.name;
                      } else {
                        return `${spec.imported.name} as ${spec.local.name}`;
                      }
                    });

                    let newImportStatement = 'import discourseComputed';
                    if (namedImportStrings.length > 0) {
                      newImportStatement += `, { ${namedImportStrings.join(', ')} }`;
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
          if (node.parent && node.parent.type === 'Decorator') {
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
              message: `Cannot auto-fix ${discourseComputedLocalName} in classic Ember classes. Please convert to native ES6 class first.`,
            });
            return;
          }
        }
      },

      Property(node) {
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
                return decorator.expression.callee.name === discourseComputedLocalName;
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
                message: `Cannot auto-fix @${discourseComputedLocalName} in classic Ember classes. Please convert to native ES6 class first.`,
              });
              return;
            }
          }
        }
      },

      MethodDefinition(node) {
        if (!node.decorators || node.decorators.length === 0) {
          return;
        }

        // Find decorator using the tracked local name
        const discourseComputedDecorator = node.decorators.find(
          (decorator) => {
            if (decorator.expression.type === "CallExpression") {
              return decorator.expression.callee.name === discourseComputedLocalName;
            }
            return decorator.expression.name === discourseComputedLocalName;
          }
        );

        if (!discourseComputedDecorator) {
          return;
        }

        // Get decorator arguments
        const decoratorExpression = discourseComputedDecorator.expression;
        let decoratorArgs = [];
        if (decoratorExpression.type === "CallExpression") {
          decoratorArgs = decoratorExpression.arguments.map((arg) => {
            if (arg.type === "Literal") {
              return arg.value;
            }
            return null;
          }).filter(Boolean);
        }

        // Check if any parameters are reassigned in the method body
        // This requires manual intervention, so we skip auto-fix
        const paramNames = node.value.params.map((param) => param.name);
        let hasParameterReassignment = false;
        let hasParameterInSpread = false;

        if (paramNames.length > 0) {
          const checkForReassignmentOrSpread = (astNode) => {
            if (!astNode || typeof astNode !== 'object') {
              return;
            }

            // Check for assignment to a parameter
            if (astNode.type === 'AssignmentExpression' &&
                astNode.left &&
                astNode.left.type === 'Identifier' &&
                paramNames.includes(astNode.left.name)) {
              hasParameterReassignment = true;
              return;
            }

            // Check for update expressions (++, --)
            if (astNode.type === 'UpdateExpression' &&
                astNode.argument &&
                astNode.argument.type === 'Identifier' &&
                paramNames.includes(astNode.argument.name)) {
              hasParameterReassignment = true;
              return;
            }

            // Check for spread elements containing parameters or their properties
            if (astNode.type === 'SpreadElement') {
              const checkSpreadArgument = (node) => {
                if (!node) return;

                // Direct parameter: ...param
                if (node.type === 'Identifier' && paramNames.includes(node.name)) {
                  hasParameterInSpread = true;
                  return;
                }

                // Member expression: ...param.property
                if (node.type === 'MemberExpression') {
                  let obj = node.object;
                  while (obj) {
                    if (obj.type === 'Identifier' && paramNames.includes(obj.name)) {
                      hasParameterInSpread = true;
                      return;
                    }
                    if (obj.type === 'MemberExpression') {
                      obj = obj.object;
                    } else {
                      break;
                    }
                  }
                }
              };

              checkSpreadArgument(astNode.argument);
            }

            // Recursively check children
            for (const key in astNode) {
              if (key === 'parent' || key === 'range' || key === 'loc') {
                continue;
              }
              const child = astNode[key];
              if (Array.isArray(child)) {
                child.forEach(item => checkForReassignmentOrSpread(item));
              } else {
                checkForReassignmentOrSpread(child);
              }
            }
          };

          checkForReassignmentOrSpread(node.value.body);
        }

        // Check if we need to rename non-fixable decorators
        // This happens when: import was originally named 'computed', we're keeping it (mixed scenario),
        // and we renamed it to 'discourseComputed'
        const { hasParameterReassignments } = analyzeDiscourseComputedUsage();
        const needsDecoratorRename = hasParameterReassignment &&
                                     hasParameterReassignments &&
                                     discourseComputedLocalName === 'computed';

        // Build a more descriptive error message for non-fixable cases
        let errorMessage = "Use '@computed(...)' instead of '@discourseComputed(...)'.";

        if (hasParameterReassignment) {
          // Find the parameter that's being reassigned to show in the message
          const reassignedParam = paramNames.find(paramName => {
            let found = false;
            const checkNode = (astNode) => {
              if (!astNode || typeof astNode !== 'object' || found) return;

              if ((astNode.type === 'AssignmentExpression' &&
                   astNode.left?.type === 'Identifier' &&
                   astNode.left.name === paramName) ||
                  (astNode.type === 'UpdateExpression' &&
                   astNode.argument?.type === 'Identifier' &&
                   astNode.argument.name === paramName)) {
                found = true;
                return;
              }

              for (const key in astNode) {
                if (key === 'parent' || key === 'range' || key === 'loc') continue;
                const child = astNode[key];
                if (Array.isArray(child)) {
                  child.forEach(item => checkNode(item));
                } else {
                  checkNode(child);
                }
              }
            };
            checkNode(node.value.body);
            return found;
          });

          const propertyPath = decoratorArgs[paramNames.indexOf(reassignedParam)] || reassignedParam;
          errorMessage = `Cannot auto-fix @${discourseComputedLocalName} because parameter '${reassignedParam}' is reassigned. ` +
                        `Convert to getter manually and use a local variable instead. Example: 'let ${reassignedParam} = this.${propertyPath} || defaultValue;'`;
        } else if (hasParameterInSpread) {
          // Find which parameter is used in spread
          const spreadParam = paramNames.find(paramName => {
            let found = false;
            const checkNode = (astNode) => {
              if (!astNode || typeof astNode !== 'object' || found) return;

              if (astNode.type === 'SpreadElement') {
                const arg = astNode.argument;
                if (arg?.type === 'Identifier' && arg.name === paramName) {
                  found = true;
                  return;
                }
                if (arg?.type === 'MemberExpression') {
                  let obj = arg.object;
                  while (obj) {
                    if (obj.type === 'Identifier' && obj.name === paramName) {
                      found = true;
                      return;
                    }
                    obj = obj.type === 'MemberExpression' ? obj.object : null;
                  }
                }
              }

              for (const key in astNode) {
                if (key === 'parent' || key === 'range' || key === 'loc') continue;
                const child = astNode[key];
                if (Array.isArray(child)) {
                  child.forEach(item => checkNode(item));
                } else {
                  checkNode(child);
                }
              }
            };
            checkNode(node.value.body);
            return found;
          });

          const propertyPath = decoratorArgs[paramNames.indexOf(spreadParam)] || spreadParam;
          errorMessage = `Cannot auto-fix @${discourseComputedLocalName} because parameter '${spreadParam}' is used in a spread operator. ` +
                        `Example: Use '...(this.${propertyPath} || [])' or '...(this.${propertyPath} ?? [])' for safe spreading.`;
        }

        context.report({
          node: discourseComputedDecorator,
          message: errorMessage,
          fix: (hasParameterReassignment || hasParameterInSpread)
            ? (needsDecoratorRename ? function(fixer) {
                // Just rename the decorator to match the renamed import
                if (decoratorExpression.type === "CallExpression") {
                  return fixer.replaceText(decoratorExpression.callee, "discourseComputed");
                } else {
                  return fixer.replaceText(decoratorExpression, "discourseComputed");
                }
              } : undefined)
            : function(fixer) {
            const fixes = [];

            // 1. Replace @discourseComputed with @computed in the decorator
            // Use the appropriate name (computed or alias like emberComputed)
            if (decoratorExpression.type === "CallExpression") {
              fixes.push(
                fixer.replaceText(decoratorExpression.callee, computedImportName)
              );
            } else {
              fixes.push(fixer.replaceText(decoratorExpression, computedImportName));
            }

            // 2. Convert method to getter and handle parameters
            const methodKey = node.key;
            const methodBody = node.value.body;
            const hasParams = node.value.params.length > 0;

            // Get parameter names for replacement
            const paramNames = node.value.params.map((param) => param.name);

            // Add 'get' keyword before method name if not already a getter
            if (node.kind !== "get") {
              fixes.push(
                fixer.insertTextBefore(methodKey, "get ")
              );
            }

            // Remove parameters from the method signature
            if (hasParams) {
              const paramsStart = node.value.params[0].range[0];
              const paramsEnd =
                node.value.params[node.value.params.length - 1].range[1];
              fixes.push(fixer.removeRange([paramsStart, paramsEnd]));

              // Replace parameter references with this.propertyName in method body
              // Use AST traversal to find identifiers and check their context
              const replacements = [];

              // Create a map of param names to property names
              const paramToProperty = {};
              paramNames.forEach((paramName, index) => {
                paramToProperty[paramName] = decoratorArgs[index] || paramName;
              });

              // Traverse the method body AST to find identifier references
              const traverse = (astNode) => {
                if (!astNode || typeof astNode !== 'object') {
                  return;
                }

                // Check if this is an identifier that matches a parameter name
                if (astNode.type === 'Identifier' && paramToProperty[astNode.name]) {
                  // Check if this identifier should be replaced
                  const parent = astNode.parent;

                  // Skip if it's a property key in an object literal (non-shorthand)
                  if (parent && parent.type === 'Property' && parent.key === astNode && !parent.shorthand) {
                    // This is an object property key like { data: ... }, don't replace
                    return;
                  }

                  // Skip if it's a property key in object pattern (destructuring)
                  if (parent && parent.type === 'Property' && parent.key === astNode && parent.value !== astNode) {
                    return;
                  }

                  // Skip if it's a property in a member expression (e.g., the 'toString' in title.toString())
                  // But we DO want to replace the object part (e.g., 'title' in title.toString())
                  if (parent && parent.type === 'MemberExpression' && parent.property === astNode && !parent.computed) {
                    return;
                  }

                  // Skip if it's the left side of an assignment expression (assignment target)
                  if (parent && parent.type === 'AssignmentExpression' && parent.left === astNode) {
                    return;
                  }

                  // Skip if it's part of an update expression (++, --)
                  if (parent && parent.type === 'UpdateExpression') {
                    return;
                  }

                  // Handle shorthand properties: { userId } -> { userId: this.userId }
                  if (parent && parent.type === 'Property' && parent.shorthand) {
                    const propertyPath = paramToProperty[astNode.name];
                    const optionalChainingAccess = propertyPathToOptionalChaining(propertyPath, true, false);
                    replacements.push({
                      range: astNode.range,
                      text: `${astNode.name}: ${optionalChainingAccess}`
                    });
                    return;
                  }

                  // Check if this identifier is used in a member expression as the object
                  const isInMemberExpression = parent && parent.type === 'MemberExpression' && parent.object === astNode;

                  // Check if this identifier or its member expression is used in a spread element
                  // Walk up to see if we're anywhere in a spread element's argument
                  let isInSpreadElement = false;
                  let checkNode = astNode;
                  while (checkNode && checkNode.parent) {
                    if (checkNode.parent.type === 'SpreadElement' && checkNode.parent.argument === checkNode) {
                      isInSpreadElement = true;
                      break;
                    }
                    // Stop if we've gone beyond the immediate expression context
                    if (checkNode.parent.type === 'ArrayExpression' ||
                        checkNode.parent.type === 'ObjectExpression' ||
                        checkNode.parent.type === 'CallExpression' ||
                        checkNode.parent.type === 'ReturnStatement') {
                      break;
                    }
                    checkNode = checkNode.parent;
                  }

                  // If in a spread element, we can't safely auto-fix (would need fallback like || [])
                  if (isInSpreadElement) {
                    // Skip this replacement - will be handled by not providing a fix at the method level
                    return;
                  }

                  // This identifier should be replaced
                  const propertyPath = paramToProperty[astNode.name];

                  const needsTrailingChaining = isInMemberExpression;
                  const optionalChainingAccess = propertyPathToOptionalChaining(propertyPath, true, needsTrailingChaining);

                  // If it's in a member expression and we added "?.", we need to replace the "." with "?." after it
                  if (isInMemberExpression && !isInSpreadElement && optionalChainingAccess.endsWith("?.")) {
                    // Find the position of the "." or "?." that follows the identifier (may have whitespace/newlines)
                    const fullText = sourceCode.getText();
                    let searchPos = astNode.range[1];

                    // Skip whitespace and newlines to find the "." or "?."
                    while (searchPos < fullText.length && /\s/.test(fullText.charAt(searchPos))) {
                      searchPos++;
                    }

                    const charAtPos = fullText.charAt(searchPos);
                    const nextChar = fullText.charAt(searchPos + 1);

                    // Replace the identifier with the path (without trailing "?.")
                    replacements.push({
                      range: astNode.range,
                      text: optionalChainingAccess.slice(0, -2) // Remove trailing "?." to get "this.property"
                    });

                    // Then separately replace the "." or "?." to add/preserve optional chaining
                    if (charAtPos === '?' && nextChar === '.') {
                      // Already has optional chaining, no need to change it
                    } else if (charAtPos === '.') {
                      // Replace "." with "?."
                      replacements.push({
                        range: [searchPos, searchPos + 1],
                        text: "?."
                      });
                    } else if (charAtPos === '[') {
                      // Insert "?." before "["
                      replacements.push({
                        range: [searchPos, searchPos],
                        text: "?."
                      });
                    }

                    // Also handle chained member expressions (e.g., words.map().filter())
                    // Walk up the AST to find all chained member expressions and replace their "." with "?."
                    let currentNode = parent;
                    while (currentNode) {
                      // If this is a call expression, check if its parent is a member expression (chaining)
                      if (currentNode.type === 'CallExpression' && currentNode.parent &&
                          currentNode.parent.type === 'MemberExpression' &&
                          currentNode.parent.object === currentNode) {
                        // This call expression is the object of a member expression (it's being chained)
                        const memberExpr = currentNode.parent;

                        // Find the "." before the property
                        let dotSearchPos = currentNode.range[1];
                        while (dotSearchPos < fullText.length && /\s/.test(fullText.charAt(dotSearchPos))) {
                          dotSearchPos++;
                        }

                        const dotChar = fullText.charAt(dotSearchPos);
                        const dotNextChar = fullText.charAt(dotSearchPos + 1);

                        if (dotChar === '.' && !(dotNextChar === '.')) {
                          // Regular property access, replace "." with "?."
                          replacements.push({
                            range: [dotSearchPos, dotSearchPos + 1],
                            text: "?."
                          });
                        }
                        // Continue walking up
                        currentNode = memberExpr;
                      } else {
                        currentNode = currentNode.parent;
                      }
                    }
                  } else {
                    replacements.push({
                      range: astNode.range,
                      text: optionalChainingAccess
                    });
                  }
                }

                // Recursively traverse child nodes
                for (const key in astNode) {
                  if (key === 'parent' || key === 'range' || key === 'loc') {
                    continue;
                  }

                  const child = astNode[key];
                  if (Array.isArray(child)) {
                    child.forEach(item => {
                      if (item && typeof item === 'object') {
                        item.parent = astNode;
                        traverse(item);
                      }
                    });
                  } else if (child && typeof child === 'object') {
                    child.parent = astNode;
                    traverse(child);
                  }
                }
              };

              traverse(methodBody);

              // Sort replacements by range (descending) so we replace from end to start
              // This prevents offset issues
              replacements.sort((a, b) => b.range[0] - a.range[0]);

              // Apply replacements using individual fixer operations
              if (replacements.length > 0) {
                replacements.forEach(({ range, text }) => {
                  fixes.push(fixer.replaceTextRange(range, text));
                });
              }
            }

            return fixes;
          },
        });
      },
    };
  },
};
