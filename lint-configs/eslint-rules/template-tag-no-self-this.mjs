const THIS_BINDING_TYPES = new Set([
  "ClassDeclaration",
  "ClassExpression",
  "FunctionDeclaration",
  "FunctionExpression",
]);

function findThisBindingAncestor(target) {
  let current = target.parent;
  while (current) {
    if (THIS_BINDING_TYPES.has(current.type)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Avoid using `const self = this`. Use `this` directly inside template tags.",
    },
    fixable: "code",
    schema: [], // no options
  },

  create(context) {
    return {
      VariableDeclarator(node) {
        if (
          node.id.type !== "Identifier" ||
          node.init?.type !== "ThisExpression"
        ) {
          return;
        }

        const variable = context.sourceCode.getDeclaredVariables(node)[0];
        const references = variable.references.filter(
          (ref) => ref.identifier.parent !== node
        );

        const declarationThisBinding = findThisBindingAncestor(node);

        const referencedOnlyInAdjacentTemplateTag = references.every((ref) => {
          if (ref.identifier.type !== "VarHead") {
            return false;
          }
          return (
            findThisBindingAncestor(ref.identifier) === declarationThisBinding
          );
        });

        if (referencedOnlyInAdjacentTemplateTag) {
          context.report({
            node,
            message:
              "Remove `self = this` and use `this` directly inside template tags.",
            fix(fixer) {
              const fixes = [];

              // Replace all references to `self` with `this`
              references.forEach((ref) => {
                fixes.push(fixer.replaceText(ref.identifier, "this"));
              });

              // Remove the original variable declaration
              fixes.push(fixer.remove(node.parent));

              return fixes;
            },
          });
        }
      },
    };
  },
};
