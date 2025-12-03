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

    return {
      ImportDeclaration(node) {
        // Check if computed is already imported from @ember/object
        if (node.source.value === "@ember/object") {
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
            context.report({
              node,
              message:
                'Use \'import { computed } from "@ember/object";\' instead of \'import discourseComputed from "discourse/lib/decorators";\'.',
              fix(fixer) {
                const fixes = [];

                // Check if there are other named imports
                const namedSpecifiers = node.specifiers.filter(
                  (spec) => spec.type === "ImportSpecifier"
                );

                if (namedSpecifiers.length > 0) {
                  // Remove just the default import, keep the named imports
                  const firstNamedImport = namedSpecifiers[0];
                  const textBeforeFirstNamed = sourceCode.getText().slice(
                    node.range[0],
                    firstNamedImport.range[0]
                  );

                  // Replace "import discourseComputed, {" with "import {"
                  fixes.push(
                    fixer.replaceTextRange(
                      [node.range[0], firstNamedImport.range[0]],
                      "import { "
                    )
                  );
                } else {
                  // No other imports, replace entire import
                  fixes.push(
                    fixer.replaceText(
                      node,
                      'import { computed } from "@ember/object";'
                    )
                  );
                }

                // Add computed import if we removed the entire import or if there were other imports
                if (namedSpecifiers.length > 0) {
                  // Add new import after this one
                  fixes.push(
                    fixer.insertTextAfter(
                      node,
                      '\nimport { computed } from "@ember/object";'
                    )
                  );
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

        context.report({
          node: discourseComputedDecorator,
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'.",
          fix(fixer) {
            const fixes = [];

            // 1. Replace @discourseComputed with @computed in the decorator
            const decoratorExpression = discourseComputedDecorator.expression;
            if (decoratorExpression.type === "CallExpression") {
              fixes.push(
                fixer.replaceText(decoratorExpression.callee, "computed")
              );
            } else {
              fixes.push(fixer.replaceText(decoratorExpression, "computed"));
            }

            // 2. Remove parameters from the method
            if (node.value.params.length > 0) {
              const methodKey = node.key;
              const methodBody = node.value.body;

              // Get parameter names for replacement
              const paramNames = node.value.params.map((param) => param.name);

              // Replace method signature to remove parameters
              const paramsStart = node.value.params[0].range[0];
              const paramsEnd =
                node.value.params[node.value.params.length - 1].range[1];
              fixes.push(fixer.removeRange([paramsStart, paramsEnd]));

              // 3. Replace parameter references with this.propertyName in method body
              const bodyText = sourceCode.getText(methodBody);
              let newBodyText = bodyText;

              paramNames.forEach((paramName) => {
                // Replace standalone parameter references with this.paramName
                // Use word boundaries to avoid replacing parts of other identifiers
                const regex = new RegExp(`\\b${paramName}\\b`, "g");
                newBodyText = newBodyText.replace(
                  regex,
                  `this.${paramName}`
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
