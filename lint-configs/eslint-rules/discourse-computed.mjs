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

    // Helper function to scan all discourseComputed decorators in the file
    function analyzeDiscourseComputedUsage() {
      if (discourseComputedInfo !== null) {
        return discourseComputedInfo;
      }

      const info = {
        hasNestedProps: false,
        hasFixableDecorators: false,
      };

      // Traverse the AST to find all MethodDefinition nodes with @discourseComputed
      sourceCode.ast.body.forEach(statement => {
        // Handle class declarations
        if (statement.type === 'ClassDeclaration' || statement.type === 'ClassExpression') {
          analyzeClassBody(statement.body, info);
        }
        // Handle export default class
        if (statement.type === 'ExportDefaultDeclaration' &&
            (statement.declaration.type === 'ClassDeclaration' ||
             statement.declaration.type === 'ClassExpression')) {
          analyzeClassBody(statement.declaration.body, info);
        }
        // Handle export class
        if (statement.type === 'ExportNamedDeclaration' &&
            statement.declaration &&
            (statement.declaration.type === 'ClassDeclaration' ||
             statement.declaration.type === 'ClassExpression')) {
          analyzeClassBody(statement.declaration.body, info);
        }
      });

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

        // Check if this method has @discourseComputed decorator
        const discourseDecorator = member.decorators.find(decorator => {
          if (decorator.expression.type === 'CallExpression') {
            return decorator.expression.callee.name === 'discourseComputed';
          }
          return decorator.expression.name === 'discourseComputed';
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

          if (hasNestedProperty) {
            info.hasNestedProps = true;
          } else {
            info.hasFixableDecorators = true;
          }
        }
      });
    }

    return {
      ImportDeclaration(node) {
        // Check if computed is already imported from @ember/object
        if (node.source.value === "@ember/object") {
          emberObjectImportNode = node;
          const computedSpecifier = node.specifiers.find(
            (spec) =>
              spec.type === "ImportSpecifier" &&
              spec.imported.name === "computed"
          );
          if (computedSpecifier) {
            hasComputedImport = true;
          }
        }

        // Handle import discourseComputed from "discourse/lib/decorators"
        if (node.source.value === "discourse/lib/decorators") {
          const defaultSpecifier = node.specifiers.find(
            (spec) => spec.type === "ImportDefaultSpecifier"
          );

          if (
            defaultSpecifier &&
            defaultSpecifier.local.name === "discourseComputed"
          ) {
            // Analyze all @discourseComputed usage in the file using AST
            const { hasNestedProps, hasFixableDecorators } = analyzeDiscourseComputedUsage();

            context.report({
              node,
              message:
                'Use \'import { computed } from "@ember/object";\' instead of \'import discourseComputed from "discourse/lib/decorators";\'.',
              fix: function(fixer) {
                const fixes = [];

                // Only provide fixes if there are fixable decorators
                if (!hasFixableDecorators) {
                  return fixes;
                }

                // Check if there are other named imports in discourse/lib/decorators
                const namedSpecifiers = node.specifiers.filter(
                  (spec) => spec.type === "ImportSpecifier"
                );

                // If there are nested properties, we keep the discourseComputed import
                // Otherwise, we remove it
                if (!hasNestedProps) {
                  if (namedSpecifiers.length > 0) {
                    // Keep named imports, only remove default import
                    fixes.push(
                      fixImport(fixer, node, {
                        defaultImport: false, // Remove discourseComputed default import
                      })
                    );

                    // Add computed to @ember/object import (if not already present)
                    if (!hasComputedImport) {
                      if (emberObjectImportNode) {
                        // Add computed to existing @ember/object import
                        fixes.push(
                          fixImport(fixer, emberObjectImportNode, {
                            namedImportsToAdd: ["computed"],
                          })
                        );
                      } else {
                        // Create new @ember/object import after the modified import
                        fixes.push(
                          fixer.insertTextAfter(
                            node,
                            '\nimport { computed } from "@ember/object";'
                          )
                        );
                      }
                    }
                  } else {
                    // No named imports, remove entire import line
                    if (!hasComputedImport) {
                      if (emberObjectImportNode) {
                        // Remove discourseComputed import, add computed to @ember/object
                        const nextChar = sourceCode.getText().charAt(node.range[1]);
                        const rangeEnd = nextChar === '\n' ? node.range[1] + 1 : node.range[1];
                        fixes.push(fixer.removeRange([node.range[0], rangeEnd]));

                        fixes.push(
                          fixImport(fixer, emberObjectImportNode, {
                            namedImportsToAdd: ["computed"],
                          })
                        );
                      } else {
                        // Replace discourseComputed import with @ember/object import
                        fixes.push(
                          fixer.replaceText(
                            node,
                            'import { computed } from "@ember/object";'
                          )
                        );
                      }
                    } else {
                      // computed already imported, just remove discourseComputed
                      const nextChar = sourceCode.getText().charAt(node.range[1]);
                      const rangeEnd = nextChar === '\n' ? node.range[1] + 1 : node.range[1];
                      fixes.push(fixer.removeRange([node.range[0], rangeEnd]));
                    }
                  }
                } else {
                  // Has nested props but also has fixable decorators
                  // Keep discourseComputed import but add computed for the fixable ones
                  if (!hasComputedImport) {
                    if (emberObjectImportNode) {
                      // Add computed to existing @ember/object import
                      fixes.push(
                        fixImport(fixer, emberObjectImportNode, {
                          namedImportsToAdd: ["computed"],
                        })
                      );
                    } else {
                      // Create new @ember/object import after the discourseComputed import
                      fixes.push(
                        fixer.insertTextAfter(
                          node,
                          '\nimport { computed } from "@ember/object";'
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

      MethodDefinition(node) {
        if (!node.decorators || node.decorators.length === 0) {
          return;
        }

        // Find @discourseComputed decorator
        const discourseComputedDecorator = node.decorators.find(
          (decorator) => {
            if (decorator.expression.type === "CallExpression") {
              return decorator.expression.callee.name === "discourseComputed";
            }
            return decorator.expression.name === "discourseComputed";
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

        context.report({
          node: discourseComputedDecorator,
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'.",
          fix: hasNestedProperty ? undefined : function(fixer) {
            const fixes = [];

            // 1. Replace @discourseComputed with @computed in the decorator
            if (decoratorExpression.type === "CallExpression") {
              fixes.push(
                fixer.replaceText(decoratorExpression.callee, "computed")
              );
            } else {
              fixes.push(fixer.replaceText(decoratorExpression, "computed"));
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

              // Apply replacements
              if (replacements.length > 0) {
                let bodyText = sourceCode.getText(methodBody);

                replacements.forEach(({ range, text }) => {
                  const start = range[0] - methodBody.range[0];
                  const end = range[1] - methodBody.range[0];
                  bodyText = bodyText.slice(0, start) + text + bodyText.slice(end);
                });

                fixes.push(fixer.replaceText(methodBody, bodyText));
              }
            }

            return fixes;
          },
        });
      },
    };
  },
};
