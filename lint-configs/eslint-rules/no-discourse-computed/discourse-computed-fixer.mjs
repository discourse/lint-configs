import { propertyPathToOptionalChaining } from "../utils/property-path.mjs";

/**
 * Create a fixer function that converts a method with parameters into a getter
 * that reads from this.<property>. The fixer will:
 * - replace the decorator callee with the computed import name
 * - insert the `get ` keyword before the method name if absent
 * - remove the parameter list from the method signature
 * - replace identifier occurrences of parameters with `this.<path>` accesses
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').MethodDefinition} node
 * @param {string[]} decoratorArgs
 * @param {string} computedImportName
 * @param {{simpleReassignments?: Array}} [options]
 * @returns {(fixer: import('eslint').Rule.RuleFixer) => import('eslint').Rule.Fix[]}
 */
export function createMethodFix(
  sourceCode,
  node,
  decoratorArgs,
  computedImportName,
  options = {}
) {
  return function (fixer) {
    const fixes = [];

    // replace decorator callee/name
    const deco = node.decorators && node.decorators.find((d) => d.expression);
    const decoratorExpression = deco && deco.expression;
    if (decoratorExpression) {
      if (decoratorExpression.type === "CallExpression") {
        fixes.push(
          fixer.replaceText(decoratorExpression.callee, computedImportName)
        );
      } else {
        fixes.push(fixer.replaceText(decoratorExpression, computedImportName));
      }
    }

    const methodKey = node.key;
    const hasParams = node.value.params && node.value.params.length > 0;
    const paramNames = node.value.params
      ? node.value.params.map((p) => p.name)
      : [];

    if (node.kind !== "get") {
      fixes.push(fixer.insertTextBefore(methodKey, "get "));
    }

    if (hasParams) {
      const paramsStart = node.value.params[0].range[0];
      const paramsEnd =
        node.value.params[node.value.params.length - 1].range[1];
      fixes.push(fixer.removeRange([paramsStart, paramsEnd]));

      const paramToProperty = {};
      paramNames.forEach((name, i) => {
        paramToProperty[name] = decoratorArgs[i] || name;
      });

      // Small expression replacer used for simple-reassignment right-hand sides
      const replaceIdentifiersInExpression = (expr) => {
        if (!expr || typeof expr !== "object") {
          return sourceCode.getText(expr);
        }
        if (expr.type === "Identifier") {
          if (paramToProperty[expr.name]) {
            return propertyPathToOptionalChaining(
              paramToProperty[expr.name],
              true,
              false
            );
          }
          return expr.name;
        }
        if (expr.type === "CallExpression") {
          const callee = replaceIdentifiersInExpression(expr.callee);
          const args = expr.arguments
            .map((a) => replaceIdentifiersInExpression(a))
            .join(", ");
          return `${callee}(${args})`;
        }
        if (expr.type === "MemberExpression") {
          const object = replaceIdentifiersInExpression(expr.object);
          if (expr.computed) {
            const property = replaceIdentifiersInExpression(expr.property);
            return `${object}[${property}]`;
          }
          return `${object}.${expr.property.name}`;
        }
        if (expr.type === "ArrayExpression") {
          return `[${expr.elements.map((el) => (el ? replaceIdentifiersInExpression(el) : "")).join(", ")}]`;
        }
        if (expr.type === "ObjectExpression") {
          return sourceCode.getText(expr);
        }
        if (
          expr.type === "LogicalExpression" ||
          expr.type === "BinaryExpression"
        ) {
          return `${replaceIdentifiersInExpression(expr.left)} ${expr.operator} ${replaceIdentifiersInExpression(expr.right)}`;
        }
        if (expr.type === "ConditionalExpression") {
          return `${replaceIdentifiersInExpression(expr.test)} ? ${replaceIdentifiersInExpression(expr.consequent)} : ${replaceIdentifiersInExpression(expr.alternate)}`;
        }
        return sourceCode.getText(expr);
      };

      // Collect replacements for identifier occurrences
      const replacements = [];

      // Apply simple reassignments first if provided (these were detected earlier).
      const simpleReassignments = options.simpleReassignments || [];
      if (simpleReassignments.length > 0) {
        for (const reassignment of simpleReassignments) {
          const { statement, paramName, info, isGuard } = reassignment;

          if (isGuard) {
            // Guard clause: if (!foo) { foo = []; }
            const assignmentExpr = statement.consequent.body[0].expression;
            const access = propertyPathToOptionalChaining(
              paramToProperty[paramName],
              true,
              false
            );
            const newRight = replaceIdentifiersInExpression(
              assignmentExpr.right
            );
            // Example: let foo = this.foo || [];
            // We use 'let' because it was inside an 'if', implying it might be reassigned
            // (though our analysis ensures it's the ONLY assignment in simple cases)
            replacements.push({
              range: statement.range,
              text: `let ${paramName} = ${access} || ${newRight};`,
            });
          } else {
            // Direct assignment: foo = foo || [];
            const assignmentExpr = statement.expression;
            const useConst = info.assignments.length === 1;
            const keyword = useConst ? "const" : "let";
            const newRight = replaceIdentifiersInExpression(
              assignmentExpr.right
            );
            replacements.push({
              range: statement.range,
              text: `${keyword} ${paramName} = ${newRight};`,
            });
          }
          // prevent further replacements for this param
          delete paramToProperty[paramName];
        }
      }

      // Use ESLint scope analysis to find all references to parameters
      const scope = sourceCode.getScope(node.value);
      for (const variable of scope.variables) {
        if (!paramToProperty[variable.name] || variable.scope !== scope) {
          continue;
        }

        const propertyPath = paramToProperty[variable.name];

        for (const reference of variable.references) {
          const refNode = reference.identifier;
          const parent = refNode.parent;

          // contexts to skip
          if (
            parent &&
            parent.type === "Property" &&
            parent.key === refNode &&
            !parent.shorthand
          ) {
            continue;
          }
          if (
            parent &&
            parent.type === "Property" &&
            parent.key === refNode &&
            parent.value !== refNode
          ) {
            continue;
          }
          if (
            parent &&
            parent.type === "MemberExpression" &&
            parent.property === refNode &&
            !parent.computed
          ) {
            continue;
          }
          if (reference.isWrite()) {
            continue;
          }

          // shorthand property: { foo } -> { foo: this.foo }
          if (parent && parent.type === "Property" && parent.shorthand) {
            const access = propertyPathToOptionalChaining(
              propertyPath,
              true,
              false
            );
            replacements.push({
              range: refNode.range,
              text: `${refNode.name}: ${access}`,
            });
            continue;
          }

          const isInMemberExpression =
            parent &&
            parent.type === "MemberExpression" &&
            parent.object === refNode;

          const access = propertyPathToOptionalChaining(
            propertyPath,
            true,
            isInMemberExpression
          );

          if (isInMemberExpression && access.endsWith("?.")) {
            // Replace identifier with access without trailing '?.'
            replacements.push({
              range: refNode.range,
              text: access.slice(0, -2),
            });

            // adjust following punctuation to avoid '?..' (replace '.' with '?.' or insert '?.' before '[')
            const fullText = sourceCode.getText();
            let pos = refNode.range[1];
            while (pos < fullText.length && /\s/.test(fullText.charAt(pos))) {
              pos++;
            }
            const ch = fullText.charAt(pos);
            const nextCh = fullText.charAt(pos + 1);

            if (ch === "?" && nextCh === ".") {
              // already '?.' — nothing
            } else if (ch === ".") {
              replacements.push({ range: [pos, pos + 1], text: "?." });
            } else if (ch === "[") {
              replacements.push({ range: [pos, pos], text: "?." });
            } else if (ch === "\n") {
              // Multiline member expression: prefer replacing the '.' at the start of the next
              // non-whitespace character with '?.' so lines like '\n  .filter' become '\n  ?.filter'.
              let insertPos = pos;
              while (
                insertPos < fullText.length &&
                /\s/.test(fullText.charAt(insertPos))
              ) {
                insertPos++;
              }
              const nextChar = fullText.charAt(insertPos);
              if (nextChar === ".") {
                replacements.push({
                  range: [insertPos, insertPos + 1],
                  text: "?.",
                });
              } else {
                // Fallback: insert '?.' at the computed position
                replacements.push({
                  range: [insertPos, insertPos],
                  text: "?.",
                });
              }
            }

            // Additionally, propagate optional chaining to chained call/member sequences.
            let ancestor = parent.parent;
            while (ancestor) {
              if (
                ancestor.type === "CallExpression" &&
                ancestor.parent &&
                ancestor.parent.type === "MemberExpression"
              ) {
                const afterCallPos = ancestor.range[1];
                let p = afterCallPos;
                while (p < fullText.length && /\s/.test(fullText.charAt(p))) {
                  p++;
                }
                if (fullText.charAt(p) === ".") {
                  replacements.push({ range: [p, p + 1], text: "?." });
                }
                ancestor = ancestor.parent.parent;
                continue;
              }
              break;
            }
          } else {
            replacements.push({ range: refNode.range, text: access });
          }
        }
      }

      // Apply replacements from end to start in a single pass so fixes don't overlap
      replacements.sort((a, b) => b.range[0] - a.range[0]);
      for (const r of replacements) {
        fixes.push(fixer.replaceTextRange(r.range, r.text));
      }
    }

    return fixes;
  };
}
