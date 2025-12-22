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
            // Check if any @discourseComputed usage has nested properties
            const ast = sourceCode.ast;
            let hasNestedProps = false;
            let hasFixableDecorators = false;

            // Simple regex check in source code for @discourseComputed with nested properties
            const sourceText = sourceCode.getText();
            const decoratorPattern = /@discourseComputed\([^)]*"[^"]*\.[^"]*"[^)]*\)/;
            const allDiscourseComputedPattern = /@discourseComputed(?:\([^)]*\))?/g;

            hasNestedProps = decoratorPattern.test(sourceText);

            // Check if there are any fixable decorators (without nested properties)
            const allMatches = sourceText.match(allDiscourseComputedPattern) || [];
            hasFixableDecorators = allMatches.some(match => !decoratorPattern.test(match));

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
                    // Remove just the default import, keep the named imports
                    const firstNamedImport = namedSpecifiers[0];
                    fixes.push(
                      fixer.replaceTextRange(
                        [node.range[0], firstNamedImport.range[0]],
                        "import { "
                      )
                    );

                    // Add computed import after this line (since we're keeping the import)
                    if (!emberObjectImportNode || !hasComputedImport) {
                      if (emberObjectImportNode && !hasComputedImport) {
                        // Add computed to existing @ember/object import
                        const lastSpecifier = emberObjectImportNode.specifiers[emberObjectImportNode.specifiers.length - 1];
                        fixes.push(
                          fixer.insertTextAfter(lastSpecifier, ", computed")
                        );
                      } else if (!emberObjectImportNode) {
                        // Add new @ember/object import after current import
                        fixes.push(
                          fixer.insertTextAfter(
                            node,
                            '\nimport { computed } from "@ember/object";'
                          )
                        );
                      }
                    }
                  } else {
                    // No other imports from discourse/lib/decorators, replace entire import
                    if (emberObjectImportNode && !hasComputedImport) {
                      // We have @ember/object import, remove discourseComputed and add computed to it
                      const nextChar = sourceCode.getText().charAt(node.range[1]);
                      const rangeEnd = nextChar === '\n' ? node.range[1] + 1 : node.range[1];
                      fixes.push(fixer.removeRange([node.range[0], rangeEnd]));

                      const lastSpecifier = emberObjectImportNode.specifiers[emberObjectImportNode.specifiers.length - 1];
                      fixes.push(
                        fixer.insertTextAfter(lastSpecifier, ", computed")
                      );
                    } else if (!emberObjectImportNode) {
                      // No @ember/object import, replace discourseComputed import with it
                      fixes.push(
                        fixer.replaceText(
                          node,
                          'import { computed } from "@ember/object";'
                        )
                      );
                    }
                  }
                } else {
                  // Has nested props but also has fixable decorators
                  // Keep discourseComputed import but add computed for the fixable ones
                  if (emberObjectImportNode && !hasComputedImport) {
                    // Add computed to existing @ember/object import
                    const lastSpecifier = emberObjectImportNode.specifiers[emberObjectImportNode.specifiers.length - 1];
                    fixes.push(
                      fixer.insertTextAfter(lastSpecifier, ", computed")
                    );
                  } else if (!emberObjectImportNode) {
                    // Add new @ember/object import after current import
                    fixes.push(
                      fixer.insertTextAfter(
                        node,
                        '\nimport { computed } from "@ember/object";'
                      )
                    );
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
              const bodyText = sourceCode.getText(methodBody);
              let newBodyText = bodyText;

              paramNames.forEach((paramName, index) => {
                // Use the corresponding decorator argument if available, otherwise use param name
                const propertyName = decoratorArgs[index] || paramName;

                // Replace standalone parameter references with this.propertyName
                // Use word boundaries to avoid replacing parts of other identifiers
                const regex = new RegExp(`\\b${paramName}\\b`, "g");
                newBodyText = newBodyText.replace(
                  regex,
                  `this.${propertyName}`
                );
              });

              if (newBodyText !== bodyText) {
                fixes.push(fixer.replaceText(methodBody, newBodyText));
              }
            }

            return fixes;
          },
        });
      },
    };
  },
};
