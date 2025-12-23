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
    const methodBody = node.value.body;
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
          const { statement, paramName, info } = reassignment;
          const assignmentExpr = statement.expression;
          const useConst = info.assignments.length === 1;
          const keyword = useConst ? "const" : "let";
          const newRight = replaceIdentifiersInExpression(assignmentExpr.right);
          // Queue this replacement alongside identifier replacements to be applied in a single pass
          replacements.push({
            range: assignmentExpr.range,
            text: `${keyword} ${paramName} = ${newRight}`,
          });
          // prevent further replacements for this param
          delete paramToProperty[paramName];
        }
      }

      const traverse = (astNode) => {
        if (!astNode || typeof astNode !== "object") {
          return;
        }

        if (astNode.type === "Identifier" && paramToProperty[astNode.name]) {
          const parent = astNode.parent;

          // contexts to skip
          if (
            parent &&
            parent.type === "Property" &&
            parent.key === astNode &&
            !parent.shorthand
          ) {
            return;
          }
          if (
            parent &&
            parent.type === "Property" &&
            parent.key === astNode &&
            parent.value !== astNode
          ) {
            return;
          }
          if (
            parent &&
            parent.type === "MemberExpression" &&
            parent.property === astNode &&
            !parent.computed
          ) {
            return;
          }
          if (
            parent &&
            parent.type === "AssignmentExpression" &&
            parent.left === astNode
          ) {
            return;
          }
          if (parent && parent.type === "UpdateExpression") {
            return;
          }

          // shorthand property: { foo } -> { foo: this.foo }
          if (parent && parent.type === "Property" && parent.shorthand) {
            const access = propertyPathToOptionalChaining(
              paramToProperty[astNode.name],
              true,
              false
            );
            replacements.push({
              range: astNode.range,
              text: `${astNode.name}: ${access}`,
            });
            return;
          }

          const isInMemberExpression =
            parent &&
            parent.type === "MemberExpression" &&
            parent.object === astNode;

          const access = propertyPathToOptionalChaining(
            paramToProperty[astNode.name],
            true,
            isInMemberExpression
          );

          if (isInMemberExpression && access.endsWith("?.")) {
            // Replace identifier with access without trailing '?.'
            replacements.push({
              range: astNode.range,
              text: access.slice(0, -2),
            });

            // adjust following punctuation to avoid '?..' (replace '.' with '?.' or insert '?.' before '[')
            const fullText = sourceCode.getText();
            let pos = astNode.range[1];
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
            // e.g. this.foo?.map(...).filter(...) -> after replacing object, we also want to turn
            // the '.' before 'filter' into '?.'. Walk up through call->member chains and replace dots.
            let ancestor = parent.parent; // parent is MemberExpression, parent.parent might be CallExpression
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
                // move up: ancestor.parent is MemberExpression; check if that MemberExpression is then used in another CallExpression
                ancestor = ancestor.parent.parent;
                continue;
              }
              break;
            }
          } else {
            replacements.push({ range: astNode.range, text: access });
          }
        }

        for (const key in astNode) {
          if (key === "parent" || key === "range" || key === "loc") {
            continue;
          }
          const child = astNode[key];
          if (Array.isArray(child)) {
            child.forEach((c) => {
              if (c && typeof c === "object") {
                c.parent = astNode;
                traverse(c);
              }
            });
          } else if (child && typeof child === "object") {
            child.parent = astNode;
            traverse(child);
          }
        }
      };

      traverse(methodBody);

      // Apply replacements from end to start in a single pass so fixes don't overlap
      replacements.sort((a, b) => b.range[0] - a.range[0]);
      for (const r of replacements) {
        fixes.push(fixer.replaceTextRange(r.range, r.text));
      }
    }

    return fixes;
  };
}
