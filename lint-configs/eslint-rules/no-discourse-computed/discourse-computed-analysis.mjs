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
      node.callee.property.name === "extend" &&
      node.callee.object &&
      node.callee.object.type === "Identifier" &&
      /^(Component|Controller|Route|EmberObject|Service|Object)$/.test(
        node.callee.object.name
      )
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
            parent.callee.property.name === "extend" &&
            parent.callee.object &&
            parent.callee.object.type === "Identifier" &&
            /^(Component|Controller|Route|EmberObject|Service|Object)$/.test(
              parent.callee.object.name
            )
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

    const functionNode = methodNode.value;
    const paramNames = functionNode.params.map((p) => p.name);

    if (paramNames.length === 0) {
      return { canAutoFix: true };
    }

    // Use ESLint scope analysis to find all references to parameters
    const scope = sourceCode.getScope(functionNode);
    const parameterReassignmentInfo = {};
    let hasParameterInSpread = false;
    let spreadParam = null;
    let hasUnsafeOptionalChaining = false;
    let unsafeOptionalChainingParam = null;
    let hasParameterInNestedFunction = false;
    let nestedFunctionParam = null;

    for (const variable of scope.variables) {
      if (!paramNames.includes(variable.name) || variable.scope !== scope) {
        continue;
      }

      const paramIndex = paramNames.indexOf(variable.name);
      const propertyPath = decoratorArgs[paramIndex] || variable.name;

      for (const reference of variable.references) {
        const refNode = reference.identifier;
        const parent = refNode.parent;

        // 1. Check for nested function usage (non-arrow)
        // In ESLint scope, reference.from gives the scope where the reference occurs
        let currentScope = reference.from;
        while (currentScope && currentScope !== scope) {
          if (
            currentScope.type === "function" &&
            currentScope.block.type !== "ArrowFunctionExpression"
          ) {
            hasParameterInNestedFunction = true;
            nestedFunctionParam = variable.name;
            break;
          }
          currentScope = currentScope.upper;
        }

        // 2. Check for reassignment
        if (reference.isWrite()) {
          if (!parameterReassignmentInfo[variable.name]) {
            parameterReassignmentInfo[variable.name] = {
              assignments: [],
              hasUpdateExpression: false,
            };
          }

          if (parent.type === "UpdateExpression") {
            parameterReassignmentInfo[variable.name].hasUpdateExpression = true;
          } else if (parent.type === "AssignmentExpression") {
            // Determine nesting depth for reassignment
            let depth = 0;
            let ancestor = parent.parent;
            while (ancestor && ancestor !== functionNode.body) {
              if (
                /^(If|For|While|DoWhile|Switch|Try)Statement$/.test(
                  ancestor.type
                )
              ) {
                depth++;
              }
              ancestor = ancestor.parent;
            }

            parameterReassignmentInfo[variable.name].assignments.push({
              node: parent,
              depth,
            });
          }
        }

        // 3. Check for spread usage
        let spreadCheck = parent;
        while (spreadCheck && spreadCheck !== functionNode.body) {
          if (spreadCheck.type === "SpreadElement") {
            // Check if it's a "safe" spread pattern: ...(param || [])
            const arg = spreadCheck.argument;
            const isSafe =
              arg.type === "LogicalExpression" &&
              (arg.operator === "||" || arg.operator === "??") &&
              arg.right.type === "ArrayExpression";

            if (!isSafe) {
              hasParameterInSpread = true;
              spreadParam = variable.name;
            }
            break;
          }
          spreadCheck = spreadCheck.parent;
        }

        // 4. Check for unsafe optional chaining
        const isNestedProperty =
          propertyPath.includes(".") ||
          propertyPath.includes("{") ||
          propertyPath.includes("@") ||
          propertyPath.includes("[");

        if (isNestedProperty) {
          let current = refNode;
          let inUnsafeLogical = false;

          while (
            current.parent &&
            (current.parent.type === "LogicalExpression" ||
              current.parent.type === "ConditionalExpression" ||
              current.parent.type === "MemberExpression")
          ) {
            const p = current.parent;

            if (p.type === "LogicalExpression") {
              const isSafeFallback =
                (p.operator === "||" || p.operator === "??") &&
                p.right.type === "Literal";
              if (!isSafeFallback) {
                inUnsafeLogical = true;
              }
            } else if (p.type === "ConditionalExpression") {
              inUnsafeLogical = true;
            } else if (p.type === "MemberExpression") {
              if (inUnsafeLogical && p.object === current) {
                hasUnsafeOptionalChaining = true;
                unsafeOptionalChainingParam = variable.name;
                break;
              }
            }
            current = p;
          }
        }
      }
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
