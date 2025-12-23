/**
 * @fileoverview Analysis helpers for the `no-discourse-computed` ESLint rule.
 *
 * These helpers are intentionally isolated so they can be reused by other
 * rules or tests. They perform read-only AST traversal and return detailed
 * information about @discourseComputed usages to determine auto-fixability.
 */

/**
 * @typedef {Object} UsageInfo
 * @property {string} [messageId] - The suggested messageId if not fixable
 * @property {Object} [reportData] - Data for the report message
 * @property {boolean} canAutoFix - Whether this specific usage is auto-fixable
 * @property {boolean} isClassic - Whether this is a classic Ember class usage
 * @property {Array} [simpleReassignments] - List of simple reassignments for the fixer
 */

/**
 * @typedef {Object} DiscourseComputedInfo
 * @property {boolean} hasFixableDecorators
 * @property {boolean} hasClassicClassDecorators
 * @property {boolean} hasParameterReassignments
 * @property {boolean} hasParametersInSpread
 * @property {boolean} hasUnsafeOptionalChaining
 * @property {boolean} hasParameterInNestedFunction
 * @property {Map<import('estree').Node, UsageInfo>} usageMap - Map of nodes to their detailed usage info
 */

/**
 * Analyze the source AST to detect various usages of `@discourseComputed` that
 * determine whether decorators are safe to auto-fix.
 *
 * @param {import('eslint').SourceCode} sourceCode - ESLint SourceCode instance
 * @param {string|null} discourseComputedLocalName - local identifier name used for the discourseComputed import
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
    usageMap: new Map(),
  };

  if (!discourseComputedLocalName) {
    return info;
  }

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

    // Handle direct CallExpression of discourseComputed (classic classes)
    if (
      node.type === "CallExpression" &&
      node.callee &&
      node.callee.name === discourseComputedLocalName
    ) {
      // Check if this CallExpression is part of a decorator
      const isDecorator = node.parent && node.parent.type === "Decorator";
      if (!isDecorator) {
        // Check if we're inside a .extend() call
        let parent = node.parent;
        let isClassicClass = false;
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
          info.hasClassicClassDecorators = true;
          info.usageMap.set(node, {
            canAutoFix: false,
            isClassic: true,
            messageId: "cannotAutoFixClassic",
            reportData: { name: discourseComputedLocalName },
          });
        }
      }
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
        const expr = decorator.expression;
        if (expr.type === "CallExpression") {
          return expr.callee.name === discourseComputedLocalName;
        }
        return expr.name === discourseComputedLocalName;
      });

      if (!discourseDecorator) {
        return;
      }

      const usageInfo = analyzeMethodUsage(member, discourseDecorator);
      infoObj.usageMap.set(discourseDecorator, usageInfo);

      // Update global summary flags
      if (usageInfo.canAutoFix) {
        infoObj.hasFixableDecorators = true;
      } else if (usageInfo.isClassic) {
        infoObj.hasClassicClassDecorators = true;
      } else {
        const mid = usageInfo.messageId;
        if (mid === "cannotAutoFixNestedFunction") {
          infoObj.hasParameterInNestedFunction = true;
        } else if (mid === "cannotAutoFixUnsafeOptionalChaining") {
          infoObj.hasUnsafeOptionalChaining = true;
        } else if (mid === "cannotAutoFixSpread") {
          infoObj.hasParametersInSpread = true;
        } else {
          infoObj.hasParameterReassignments = true;
        }
      }
    });
  }

  function analyzeMethodUsage(methodNode, decoratorNode) {
    const decoratorExpression = decoratorNode.expression;
    let decoratorArgs = [];
    if (decoratorExpression.type === "CallExpression") {
      decoratorArgs = decoratorExpression.arguments
        .map((arg) => (arg.type === "Literal" ? arg.value : null))
        .filter(Boolean);
    }

    const paramNames =
      methodNode.value && methodNode.value.params
        ? methodNode.value.params.map((p) => p.name)
        : [];

    const parameterReassignmentInfo = {};
    let hasParameterInSpread = false;
    let spreadParam = null;
    let hasUnsafeOptionalChaining = false;
    let unsafeOptionalChainingParam = null;
    let hasParameterInNestedFunction = false;
    let nestedFunctionParam = null;

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
            nestedFunctionParam = astNode.name;
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
                    unsafeOptionalChainingParam = childNode.name;
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
                spreadParam = childNode.name;
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
                    spreadParam = obj.name;
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

      checkForReassignmentOrSpread(methodNode.value.body, 0, false);
    }

    const hasParameterReassignment =
      Object.keys(parameterReassignmentInfo).length > 0;

    const simpleReassignments = [];
    if (
      hasParameterReassignment &&
      !hasParameterInSpread &&
      methodNode.value.body.body &&
      methodNode.value.body.body.length > 0
    ) {
      for (let i = 0; i < methodNode.value.body.body.length; i++) {
        const statement = methodNode.value.body.body[i];
        if (
          statement.type === "ExpressionStatement" &&
          statement.expression.type === "AssignmentExpression" &&
          statement.expression.left.type === "Identifier" &&
          paramNames.includes(statement.expression.left.name)
        ) {
          const paramName = statement.expression.left.name;
          const paramInfo = parameterReassignmentInfo[paramName];
          if (paramInfo && !paramInfo.hasUpdateExpression) {
            const firstAssignment = paramInfo.assignments[0];
            if (
              firstAssignment &&
              firstAssignment.depth === 0 &&
              firstAssignment.node === statement.expression
            ) {
              simpleReassignments.push({ statement, paramName, info: paramInfo });
              continue;
            }
          }
        }
        break;
      }
    }

    const reportData = { name: discourseComputedLocalName };
    const hasSimpleReassignments = simpleReassignments.length > 0;

    if (hasParameterInNestedFunction) {
      const idx = paramNames.indexOf(nestedFunctionParam);
      return {
        canAutoFix: false,
        messageId: "cannotAutoFixNestedFunction",
        reportData: {
          ...reportData,
          param: nestedFunctionParam,
          propertyPath: decoratorArgs[idx] || nestedFunctionParam,
        },
      };
    }

    if (hasUnsafeOptionalChaining) {
      const idx = paramNames.indexOf(unsafeOptionalChainingParam);
      return {
        canAutoFix: false,
        messageId: "cannotAutoFixUnsafeOptionalChaining",
        reportData: {
          ...reportData,
          param: unsafeOptionalChainingParam,
          propertyPath: decoratorArgs[idx] || unsafeOptionalChainingParam,
        },
      };
    }

    if (hasParameterInSpread) {
      const idx = paramNames.indexOf(spreadParam);
      return {
        canAutoFix: false,
        messageId: "cannotAutoFixSpread",
        reportData: {
          ...reportData,
          param: spreadParam,
          propertyPath: decoratorArgs[idx] || spreadParam,
        },
      };
    }

    if (hasParameterReassignment && !hasSimpleReassignments) {
      const reassignedParam = Object.keys(parameterReassignmentInfo)[0];
      const reassignedInfo = parameterReassignmentInfo[reassignedParam] || {};
      const idx = paramNames.indexOf(reassignedParam);
      const propertyPath = decoratorArgs[idx] || reassignedParam;

      let messageId = "cannotAutoFixGeneric";
      if (reassignedInfo.hasUpdateExpression) {
        messageId = "cannotAutoFixUpdateExpression";
      } else if (
        reassignedInfo.assignments &&
        reassignedInfo.assignments.length > 0 &&
        reassignedInfo.assignments[0].depth > 0
      ) {
        messageId = "cannotAutoFixNestedReassignment";
      }

      return {
        canAutoFix: false,
        messageId,
        reportData: { ...reportData, param: reassignedParam, propertyPath },
      };
    }

    return {
      canAutoFix: true,
      simpleReassignments,
    };
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
          const expr = decorator.expression;
          if (expr.type === "CallExpression") {
            return expr.callee.name === discourseComputedLocalName;
          }
          return expr.name === discourseComputedLocalName;
        });

        if (discourseDecorator) {
          infoObj.hasClassicClassDecorators = true;
          infoObj.usageMap.set(discourseDecorator, {
            canAutoFix: false,
            isClassic: true,
            messageId: "cannotAutoFixClassic",
            reportData: { name: `@${discourseComputedLocalName}` },
          });
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
        infoObj.usageMap.set(prop.value, {
          canAutoFix: false,
          isClassic: true,
          messageId: "cannotAutoFixClassic",
          reportData: { name: discourseComputedLocalName },
        });
      }
    });
  }
}
