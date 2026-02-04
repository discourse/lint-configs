function getImportIdentifier(node, source, namedImportIdentifier = null) {
  if (node.source.value !== source) {
    return null;
  }

  return node.specifiers
    .filter((specifier) => {
      return (
        (specifier.type === "ImportSpecifier" &&
          specifier.imported.name === namedImportIdentifier) ||
        (!namedImportIdentifier && specifier.type === "ImportDefaultSpecifier")
      );
    })
    .map((specifier) => specifier.local.name)
    .pop();
}

function isComponentClass(node, componentNames) {
  return (
    node.superClass?.type === "Identifier" &&
    componentNames.has(node.superClass.name)
  );
}

function getAssignedPropertyName(node) {
  if (
    node?.type !== "MemberExpression" ||
    node.object?.type !== "ThisExpression"
  ) {
    return null;
  }

  if (!node.computed && node.property?.type === "Identifier") {
    return node.property.name;
  }

  if (node.computed && node.property?.type === "Literal") {
    return node.property.value;
  }

  return null;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow @tracked for properties that are never reassigned in components when only used in templates.",
    },
    schema: [], // no options
  },

  create(context) {
    const componentNames = new Set();
    const classStack = [];
    const mutUses = new Set();

    function currentClass() {
      return classStack[classStack.length - 1];
    }

    function markAssigned(name) {
      const current = currentClass();
      if (!current || !name) {
        return;
      }
      current.assigned.add(name);
    }

    function handleTrackedProperty(node) {
      const current = currentClass();
      if (!current || node.static || !node.decorators?.length) {
        return;
      }

      const hasTrackedDecorator = node.decorators.some((decorator) => {
        const expression = decorator.expression;
        return (
          expression?.type === "Identifier" && expression.name === "tracked"
        );
      });

      if (!hasTrackedDecorator || node.key?.type !== "Identifier") {
        return;
      }

      current.trackedProps.set(node.key.name, node);
    }

    function handleGlimmerSubExpression(node) {
      if (node.path.head.type !== "VarHead" || node.path.head.name !== "mut") {
        return;
      }

      const firstParam = node.params?.[0];
      if (firstParam.type !== "GlimmerPathExpression") {
        return;
      }

      if (firstParam.head.type === "ThisHead" && firstParam.tail.length) {
        mutUses.add(firstParam.tail[0]);
      }
    }

    return {
      ImportDeclaration(node) {
        const glimmerComponentName = getImportIdentifier(
          node,
          "@glimmer/component"
        );
        if (glimmerComponentName) {
          componentNames.add(glimmerComponentName);
        }

        const emberComponentName = getImportIdentifier(
          node,
          "@ember/component"
        );
        if (emberComponentName) {
          componentNames.add(emberComponentName);
        }
      },

      ClassDeclaration(node) {
        if (!isComponentClass(node, componentNames)) {
          return;
        }

        classStack.push({
          node,
          trackedProps: new Map(),
          assigned: new Set(),
        });
      },

      ClassExpression(node) {
        if (!isComponentClass(node, componentNames)) {
          return;
        }

        classStack.push({
          node,
          trackedProps: new Map(),
          assigned: new Set(),
        });
      },

      "ClassDeclaration:exit"(node) {
        const current = currentClass();
        if (!current || current.node !== node) {
          return;
        }

        for (const [name, propNode] of current.trackedProps.entries()) {
          const reassigned = current.assigned.has(name);

          if (!reassigned && !mutUses.has(name)) {
            context.report({
              node: propNode,
              message: `\`${name}\` property is defined as tracked but isn't modified anywhere.`,
            });
          }
        }

        classStack.pop();
      },

      "ClassExpression:exit"(node) {
        const current = currentClass();
        if (!current || current.node !== node) {
          return;
        }

        for (const [name, propNode] of current.trackedProps.entries()) {
          const reassigned = current.assigned.has(name);

          if (!reassigned && !mutUses.has(name)) {
            context.report({
              node: propNode,
              message: `@tracked \`${name}\` is unnecessary.`,
            });
          }
        }

        classStack.pop();
      },

      ClassProperty: handleTrackedProperty,
      PropertyDefinition: handleTrackedProperty,

      AssignmentExpression(node) {
        const name = getAssignedPropertyName(node.left);
        if (name) {
          markAssigned(name);
        }
      },

      UpdateExpression(node) {
        const name = getAssignedPropertyName(node.argument);
        if (name) {
          markAssigned(name);
        }
      },

      GlimmerSubExpression: handleGlimmerSubExpression,
    };
  },
};
