/**
 * `isDestroyed` implies `isDestroying` on every object whose flags come from
 * the destroyable registry. Both read one monotonic state counter, so in
 * `this.isDestroying || this.isDestroyed` the second operand is dead code,
 * and `!this.isDestroying && !this.isDestroyed` collapses the same way.
 *
 * The verbose pair is also where mistypes hide. `!isDestroying || !isDestroyed`
 * is true for the whole teardown window, so a guard written that way passes
 * exactly when it should block. That form is reported without a fix, since
 * repairing it changes behavior.
 *
 * The invariant is a property of the base class, not of the property names,
 * so a `this.` pair is only reported when the enclosing class extends a
 * default import from a module known to carry it. Any other receiver, and any
 * class the rule cannot resolve, is left alone. The function form from
 * `@ember/destroyable` needs no class check: that guarantee holds for any
 * object the registry tracks.
 */

import { fixImport } from "./utils/fix-import.mjs";

const FLAG_MODULES = new Set([
  "@glimmer/component",
  "@ember/component",
  "@ember/component/helper",
  "@ember/controller",
  "@ember/object",
  "@ember/object/core",
  "@ember/object/proxy",
  "@ember/array/proxy",
  "@ember/routing/route",
  "@ember/service",
]);

const HELPER_MODULES = new Set(["@ember/destroyable", "@glimmer/destroyable"]);

const DESTROYING = "isDestroying";
const DESTROYED = "isDestroyed";

/**
 * Walk a chain of `||` (or `&&`) expressions and return its operands in
 * source order. ESLint parses `a || b || c` left-nested, and parentheses can
 * nest either side, so both sides are flattened.
 */
function flatten(node, operator, into = []) {
  if (node.type === "LogicalExpression" && node.operator === operator) {
    flatten(node.left, operator, into);
    flatten(node.right, operator, into);
  } else {
    into.push(node);
  }

  return into;
}

/**
 * Find the import that binds `name` in the scope of `node`, if any.
 */
function importSourceFor(sourceCode, node, name) {
  let scope = sourceCode.getScope(node);

  while (scope) {
    const variable = scope.set.get(name);

    if (variable) {
      const def = variable.defs.find((d) => d.type === "ImportBinding");

      if (!def) {
        return null;
      }

      return {
        source: def.parent.source.value,
        isDefault: def.node.type === "ImportDefaultSpecifier",
        imported:
          def.node.type === "ImportSpecifier"
            ? def.node.imported.name
            : "default",
        declaration: def.parent,
        variable,
      };
    }

    scope = scope.upper;
  }

  return null;
}

/**
 * Whether `this` at `node` refers to an instance of a class that extends a
 * default import from a module carrying the invariant. Crossing a non-arrow
 * function that is not the class's own method or field initializer rebinds
 * `this`, so the walk gives up there.
 */
function thisHasFlags(sourceCode, node) {
  let current = node;

  while (current) {
    const parent = current.parent;

    if (!parent) {
      return false;
    }

    if (
      (parent.type === "FunctionExpression" ||
        parent.type === "FunctionDeclaration") &&
      !(
        parent.parent &&
        (parent.parent.type === "MethodDefinition" ||
          parent.parent.type === "PropertyDefinition") &&
        parent.parent.value === parent
      )
    ) {
      return false;
    }

    if (
      parent.type === "ClassDeclaration" ||
      parent.type === "ClassExpression"
    ) {
      const superClass = parent.superClass;

      if (!superClass || superClass.type !== "Identifier") {
        return false;
      }

      const binding = importSourceFor(sourceCode, parent, superClass.name);

      return Boolean(
        binding && binding.isDefault && FLAG_MODULES.has(binding.source)
      );
    }

    current = parent;
  }

  return false;
}

/**
 * Classify one operand of a chain. Returns `{ flag, receiver, node }` for
 * `X.isDestroying`, `X.isDestroyed`, `isDestroying(X)` and `isDestroyed(X)`,
 * with `negated` set when the operand was wrapped in a single `!`.
 */
function classify(sourceCode, operand) {
  let node = operand;
  let negated = false;

  if (node.type === "UnaryExpression" && node.operator === "!") {
    negated = true;
    node = node.argument;
  }

  if (
    node.type === "MemberExpression" &&
    !node.computed &&
    !node.optional &&
    node.property.type === "Identifier" &&
    (node.property.name === DESTROYING || node.property.name === DESTROYED)
  ) {
    return {
      node: operand,
      negated,
      flag: node.property.name,
      kind: "member",
      receiver: sourceCode.getText(node.object),
      receiverNode: node.object,
    };
  }

  if (
    node.type === "CallExpression" &&
    !node.optional &&
    node.callee.type === "Identifier" &&
    node.arguments.length === 1
  ) {
    const binding = importSourceFor(sourceCode, node, node.callee.name);

    if (
      binding &&
      (binding.imported === DESTROYING || binding.imported === DESTROYED) &&
      HELPER_MODULES.has(binding.source)
    ) {
      return {
        node: operand,
        negated,
        flag: binding.imported,
        kind: "helper",
        receiver: sourceCode.getText(node.arguments[0]),
        binding,
      };
    }
  }

  return null;
}

/**
 * Whether this operand's receiver is known to carry the invariant.
 */
function receiverHasFlags(sourceCode, operand) {
  if (operand.kind === "helper") {
    return true;
  }

  if (operand.receiverNode.type === "ThisExpression") {
    return thisHasFlags(sourceCode, operand.receiverNode);
  }

  return false;
}

/**
 * Locate a matching `isDestroying` / `isDestroyed` pair in a flattened chain.
 * Every operand of the pair must share polarity and receiver.
 */
function findPair(sourceCode, operands, negated) {
  const classified = operands.map((operand) => classify(sourceCode, operand));

  for (let i = 0; i < classified.length; i++) {
    const a = classified[i];

    if (!a || a.negated !== negated) {
      continue;
    }

    for (let j = 0; j < classified.length; j++) {
      const b = classified[j];

      if (
        !b ||
        i === j ||
        b.negated !== negated ||
        b.kind !== a.kind ||
        b.receiver !== a.receiver ||
        a.flag !== DESTROYING ||
        b.flag !== DESTROYED
      ) {
        continue;
      }

      if (!receiverHasFlags(sourceCode, a)) {
        return null;
      }

      return b;
    }
  }

  return null;
}

/**
 * Remove the `isDestroyed` operand from a flattened chain together with the
 * operator that joins it to its neighbor. When only one operand remains and
 * the chain sat in parentheses under a `!`, the parentheses go too, so
 * `!(a || b)` becomes `!a` rather than `!(a)`.
 */
function removeOperand(fixer, sourceCode, chain, operands, destroyed) {
  const index = operands.indexOf(destroyed.node);
  const operand = operands[index];

  if (operands.length === 2 && chain.parent.type === "UnaryExpression") {
    const open = sourceCode.getTokenBefore(chain);
    const close = sourceCode.getTokenAfter(chain);

    if (open.value === "(" && close.value === ")") {
      return fixer.replaceTextRange(
        [open.range[0], close.range[1]],
        sourceCode.getText(operands[1 - index])
      );
    }
  }

  if (index > 0) {
    return fixer.removeRange([operands[index - 1].range[1], operand.range[1]]);
  }

  return fixer.removeRange([operand.range[0], operands[index + 1].range[0]]);
}

/**
 * Drop the `isDestroyed` import once the removed call was its only use. An
 * import left with no specifiers is removed whole, along with its line break.
 */
function removeUnusedImport(fixer, sourceCode, destroyed) {
  const { binding } = destroyed;

  if (!binding || binding.variable.references.length !== 1) {
    return null;
  }

  const { declaration } = binding;

  if (declaration.specifiers.length > 1) {
    return fixImport(fixer, declaration, {
      namedImportsToRemove: [DESTROYED],
    });
  }

  const end = declaration.range[1];
  const trailingNewline = sourceCode.text[end] === "\n" ? 1 : 0;

  return fixer.removeRange([declaration.range[0], end + trailingNewline]);
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "disallow checking `isDestroyed` alongside `isDestroying`, which already implies it",
    },
    fixable: "code",
    schema: [],
    messages: {
      redundant:
        "`isDestroyed` implies `isDestroying`; drop the redundant `isDestroyed` check.",
      inverted:
        "`!isDestroying || !isDestroyed` is true throughout teardown. Use `!isDestroying` alone.",
    },
  },

  create(context) {
    const { sourceCode } = context;

    return {
      LogicalExpression(node) {
        if (node.operator !== "||" && node.operator !== "&&") {
          return;
        }

        // Only act at the top of a chain so each pair is reported once.
        if (
          node.parent.type === "LogicalExpression" &&
          node.parent.operator === node.operator
        ) {
          return;
        }

        const operands = flatten(node, node.operator);
        const negated = node.operator === "&&";
        const destroyed = findPair(sourceCode, operands, negated);

        if (destroyed) {
          context.report({
            node: destroyed.node,
            messageId: "redundant",
            fix: (fixer) =>
              [
                removeOperand(fixer, sourceCode, node, operands, destroyed),
                removeUnusedImport(fixer, sourceCode, destroyed),
              ].filter(Boolean),
          });
          return;
        }

        if (node.operator === "||") {
          const inverted = findPair(sourceCode, operands, true);

          if (inverted) {
            context.report({
              node,
              messageId: "inverted",
            });
          }
        }
      },
    };
  },
};
