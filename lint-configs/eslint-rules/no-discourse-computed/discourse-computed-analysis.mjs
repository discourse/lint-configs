/**
 * @fileoverview Analysis helpers for the `no-discourse-computed` ESLint rule.
 *
 * These helpers are intentionally isolated so they can be reused by other
 * rules or tests. They perform read-only AST traversal and return a compact
 * summary describing patterns that affect auto-fixability.
 */

/**
 * @typedef {Object} DiscourseComputedInfo
 * @property {boolean} hasFixableDecorators
 * @property {boolean} hasClassicClassDecorators
 * @property {boolean} hasParameterReassignments
 * @property {boolean} hasParametersInSpread
 * @property {boolean} hasUnsafeOptionalChaining
 * @property {boolean} hasParameterInNestedFunction
 */

/**
 * Analyze the source AST to detect various usages of `@discourseComputed` that
 * determine whether decorators are safe to auto-fix.
 *
 * This function is pure with respect to the AST (it doesn't mutate nodes) and
 * intentionally returns a small object describing the findings.
 *
 * @param {import('eslint').SourceCode} sourceCode - ESLint SourceCode instance
 * @param {string|null} discourseComputedLocalName - local identifier name used for the discourseComputed import (may be null)
 * @returns {DiscourseComputedInfo}
 */
export function analyzeDiscourseComputedUsage(
  sourceCode,
  discourseComputedLocalName
) {
  const info = {
    hasFixableDecorators: false,
    hasClassicClassDecorators: false,
    hasParameterReassignments: false,
    hasParametersInSpread: false,
    hasUnsafeOptionalChaining: false,
    hasParameterInNestedFunction: false,
  };

  // Helper to traverse any node recursively
  const traverseNode = (node) => {
    if (!node || typeof node !== "object") {
      return;
    }

    if (node.type === "ClassDeclaration" || node.type === "ClassExpression") {
      analyzeClassBody(node.body, info);
    }

    if (
      node.type === "CallExpression" &&
      node.callee &&
      node.callee.type === "MemberExpression" &&
      node.callee.property &&
      node.callee.property.name === "extend"
    ) {
      node.arguments.forEach((arg) => {
        if (arg.type === "ObjectExpression") {
          analyzeObjectExpression(arg, info);
        }
      });
    }

    for (const key in node) {
      if (key === "parent" || key === "range" || key === "loc") {
        continue;
      }
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach((item) => traverseNode(item));
      } else {
        traverseNode(child);
      }
    }
  };

  // Analyze AST body
  sourceCode.ast.body.forEach((statement) => traverseNode(statement));

  return info;

  // ---- local helpers ----

  function analyzeClassBody(classBody, infoObj) {
    if (!classBody || !classBody.body) {
      return;
    }

    classBody.body.forEach((member) => {
      if (member.type !== "MethodDefinition" || !member.decorators) {
        return;
      }

      const discourseDecorator = member.decorators.find((decorator) => {
        if (decorator.expression.type === "CallExpression") {
          return (
            decorator.expression.callee.name === discourseComputedLocalName
          );
        }
        return decorator.expression.name === discourseComputedLocalName;
      });

      if (!discourseDecorator) {
        return;
      }

      // collect decorator args if present
      const decoratorExpression = discourseDecorator.expression;
      let decoratorArgs = [];
      if (decoratorExpression.type === "CallExpression") {
        decoratorArgs = decoratorExpression.arguments
          .map((arg) => (arg.type === "Literal" ? arg.value : null))
          .filter(Boolean);
      }

      const paramNames =
        member.value && member.value.params
          ? member.value.params.map((p) => p.name)
          : [];
      const parameterReassignmentInfo = {};
      let hasParameterInSpread = false;
      let hasUnsafeOptionalChaining = false;
      let hasParameterInNestedFunction = false;

      if (paramNames.length > 0) {
        const checkForReassignmentOrSpread = (
          astNode,
          depth = 0,
          inNestedFunction = false
        ) => {
          if (!astNode || typeof astNode !== "object") {
            return;
          }

          const isNestedFunction =
            (astNode.type === "FunctionExpression" ||
              astNode.type === "FunctionDeclaration") &&
            inNestedFunction === false;
          const newInNestedFunction = inNestedFunction || isNestedFunction;

          if (
            newInNestedFunction &&
            astNode.type === "Identifier" &&
            paramNames.includes(astNode.name)
          ) {
            const parent = astNode.parent;
            if (
              !(
                parent &&
                parent.type === "FunctionExpression" &&
                parent.id === astNode
              )
            ) {
              hasParameterInNestedFunction = true;
            }
          }

          // Unsafe optional chaining checks
          if (astNode.type === "MemberExpression" && astNode.object) {
            if (
              astNode.object.type === "LogicalExpression" ||
              astNode.object.type === "ConditionalExpression"
            ) {
              const hasSafeLiteralFallback = (expr) =>
                expr.type === "LogicalExpression" &&
                (expr.operator === "||" || expr.operator === "??") &&
                expr.right.type === "Literal";
              if (!hasSafeLiteralFallback(astNode.object)) {
                const checkForNestedProps = (childNode) => {
                  if (!childNode || typeof childNode !== "object") {
                    return false;
                  }
                  if (
                    childNode.type === "Identifier" &&
                    paramNames.includes(childNode.name)
                  ) {
                    const idx = paramNames.indexOf(childNode.name);
                    const propertyPath = decoratorArgs[idx] || childNode.name;
                    if (
                      propertyPath.includes(".") ||
                      propertyPath.includes("{") ||
                      propertyPath.includes("@") ||
                      propertyPath.includes("[")
                    ) {
                      hasUnsafeOptionalChaining = true;
                      return true;
                    }
                  }
                  if (
                    childNode.type === "LogicalExpression" ||
                    childNode.type === "ConditionalExpression"
                  ) {
                    return (
                      checkForNestedProps(childNode.left) ||
                      checkForNestedProps(childNode.right) ||
                      (childNode.alternate &&
                        checkForNestedProps(childNode.alternate))
                    );
                  }
                  return false;
                };
                checkForNestedProps(astNode.object);
              }
            }
          }

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

          if (astNode.type === "SpreadElement") {
            const isSafeArrayFallback = (childNode) =>
              childNode?.type === "ArrayExpression";

            const checkSpreadArgument = (
              childNode,
              isTopLevel = true,
              isInSafeContext = false
            ) => {
              if (!childNode) {
                return;
              }
              if (isTopLevel) {
                if (
                  childNode.type === "LogicalExpression" &&
                  (childNode.operator === "||" ||
                    childNode.operator === "??") &&
                  isSafeArrayFallback(childNode.right)
                ) {
                  return;
                }
                if (
                  childNode.type === "ConditionalExpression" &&
                  isSafeArrayFallback(childNode.alternate)
                ) {
                  return;
                }
              }

              if (
                childNode.type === "Identifier" &&
                paramNames.includes(childNode.name)
              ) {
                if (!isInSafeContext) {
                  hasParameterInSpread = true;
                }
                return;
              }

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

              if (childNode.type === "ParenthesizedExpression") {
                checkSpreadArgument(
                  childNode.expression,
                  isTopLevel,
                  isInSafeContext
                );
                return;
              }

              if (!isTopLevel) {
                if (childNode.type === "LogicalExpression") {
                  checkSpreadArgument(childNode.left, false, isInSafeContext);
                  checkSpreadArgument(childNode.right, false, isInSafeContext);
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

          const isNestingNode =
            astNode.type === "IfStatement" ||
            astNode.type === "ForStatement" ||
            astNode.type === "WhileStatement" ||
            astNode.type === "DoWhileStatement" ||
            astNode.type === "SwitchStatement" ||
            astNode.type === "TryStatement";

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

        checkForReassignmentOrSpread(member.value.body, 0, false);
      }

      const hasParameterReassignment =
        Object.keys(parameterReassignmentInfo).length > 0;

      let isSimpleReassignment = false;
      if (
        hasParameterReassignment &&
        !hasParameterInSpread &&
        member.value.body.body &&
        member.value.body.body.length > 0
      ) {
        const firstStatement = member.value.body.body[0];
        if (
          firstStatement.type === "ExpressionStatement" &&
          firstStatement.expression.type === "AssignmentExpression" &&
          firstStatement.expression.left.type === "Identifier" &&
          paramNames.includes(firstStatement.expression.left.name)
        ) {
          const paramName = firstStatement.expression.left.name;
          const paramInfo = parameterReassignmentInfo[paramName];
          if (!paramInfo.hasUpdateExpression) {
            const firstAssignment = paramInfo.assignments[0];
            if (
              firstAssignment &&
              firstAssignment.depth === 0 &&
              firstAssignment.node === firstStatement.expression
            ) {
              isSimpleReassignment = true;
            }
          }
        }
      }

      if (hasParameterInNestedFunction) {
        infoObj.hasParameterInNestedFunction = true;
      } else if (hasUnsafeOptionalChaining) {
        infoObj.hasUnsafeOptionalChaining = true;
      } else if (hasParameterInSpread) {
        infoObj.hasParametersInSpread = true;
      } else if (hasParameterReassignment && !isSimpleReassignment) {
        infoObj.hasParameterReassignments = true;
      } else {
        infoObj.hasFixableDecorators = true;
      }
    });
  }

  function analyzeObjectExpression(objExpr, infoObj) {
    if (!objExpr || !objExpr.properties) {
      return;
    }

    objExpr.properties.forEach((prop) => {
      if (
        prop.type === "Property" &&
        prop.decorators &&
        prop.decorators.length > 0
      ) {
        const discourseDecorator = prop.decorators.find((decorator) => {
          if (decorator.expression.type === "CallExpression") {
            return (
              decorator.expression.callee.name === discourseComputedLocalName
            );
          }
          return decorator.expression.name === discourseComputedLocalName;
        });
        if (discourseDecorator) {
          infoObj.hasClassicClassDecorators = true;
        }
      }

      if (
        prop.type === "Property" &&
        prop.value &&
        prop.value.type === "CallExpression" &&
        prop.value.callee &&
        prop.value.callee.name === discourseComputedLocalName
      ) {
        infoObj.hasClassicClassDecorators = true;
      }
    });
  }
}
