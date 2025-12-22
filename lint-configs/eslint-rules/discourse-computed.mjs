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
        hasNestedProps: false,
        hasFixableDecorators: false,
        hasClassicClassDecorators: false,
        hasParameterReassignments: false,
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
          // Extract decorator arguments
          let hasNestedProperty = false;
          if (discourseDecorator.expression.type === 'CallExpression') {
            const args = discourseDecorator.expression.arguments;
            hasNestedProperty = args.some(arg => {
              return arg.type === 'Literal' &&
                     typeof arg.value === 'string' &&
                     arg.value.includes('.');
            });
          }

          // Check if any parameters are reassigned
          const paramNames = member.value.params.map((param) => param.name);
          let hasParameterReassignment = false;

          if (paramNames.length > 0) {
            const checkForReassignment = (astNode) => {
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

              // Recursively check children
              for (const key in astNode) {
                if (key === 'parent' || key === 'range' || key === 'loc') {
                  continue;
                }
                const child = astNode[key];
                if (Array.isArray(child)) {
                  child.forEach(item => checkForReassignment(item));
                } else {
                  checkForReassignment(child);
                }
              }
            };

            checkForReassignment(member.value.body);
          }

          if (hasNestedProperty) {
            info.hasNestedProps = true;
          } else if (hasParameterReassignment) {
            info.hasParameterReassignments = true;
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
            const { hasNestedProps, hasFixableDecorators, hasClassicClassDecorators, hasParameterReassignments } = analyzeDiscourseComputedUsage();

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

                // If there are nested properties, classic class decorators, or parameter reassignments,
                // we keep the discourseComputed import. Otherwise, we remove it
                if (!hasNestedProps && !hasClassicClassDecorators && !hasParameterReassignments) {
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
                  // Has nested props, classic class decorators, or parameter reassignments, but also has fixable decorators
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

        // Get decorator arguments to check for nested properties
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

        // Check if any decorator argument contains a nested property reference (.)
        const hasNestedProperty = decoratorArgs.some((arg) =>
          typeof arg === "string" && arg.includes(".")
        );

        // Check if any parameters are reassigned in the method body
        // This requires manual intervention, so we skip auto-fix
        const paramNames = node.value.params.map((param) => param.name);
        let hasParameterReassignment = false;

        if (paramNames.length > 0) {
          const checkForReassignment = (astNode) => {
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

            // Recursively check children
            for (const key in astNode) {
              if (key === 'parent' || key === 'range' || key === 'loc') {
                continue;
              }
              const child = astNode[key];
              if (Array.isArray(child)) {
                child.forEach(item => checkForReassignment(item));
              } else {
                checkForReassignment(child);
              }
            }
          };

          checkForReassignment(node.value.body);
        }

        // Check if we need to rename non-fixable decorators
        // This happens when: import was originally named 'computed', we're keeping it (mixed scenario),
        // and we renamed it to 'discourseComputed'
        const { hasNestedProps } = analyzeDiscourseComputedUsage();
        const needsDecoratorRename = (hasNestedProperty || hasParameterReassignment) &&
                                     hasNestedProps &&
                                     discourseComputedLocalName === 'computed';

        context.report({
          node: discourseComputedDecorator,
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'.",
          fix: (hasNestedProperty || hasParameterReassignment)
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
                    const propertyName = paramToProperty[astNode.name];
                    replacements.push({
                      range: astNode.range,
                      text: `${astNode.name}: this.${propertyName}`
                    });
                    return;
                  }

                  // This identifier should be replaced
                  const propertyName = paramToProperty[astNode.name];
                  replacements.push({
                    range: astNode.range,
                    text: `this.${propertyName}`
                  });
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
