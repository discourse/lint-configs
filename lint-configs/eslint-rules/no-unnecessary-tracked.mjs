function getImportIdentifier(node, source, namedImportIdentifier = null) {
  if (node.source.value !== source) {
    return;
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
    return;
  }

  if (!node.computed && node.property?.type === "Identifier") {
    return node.property.name;
  }

  if (node.computed && node.property?.type === "Literal") {
    return node.property.value;
  }
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
    const mutUses = new Set();
    let currentComponent;

    function markAssigned(name) {
      if (currentComponent && name) {
        currentComponent.assigned.add(name);
      }
    }

    function handleTrackedProperty(node) {
      if (!currentComponent || node.static || !node.decorators?.length) {
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

      currentComponent.trackedProps.set(node.key.name, node);
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
        if (isComponentClass(node, componentNames)) {
          currentComponent = {
            node,
            trackedProps: new Map(),
            assigned: new Set(),
          };
        }
      },

      ClassExpression(node) {
        if (isComponentClass(node, componentNames)) {
          currentComponent = {
            node,
            trackedProps: new Map(),
            assigned: new Set(),
          };
        }
      },

      "ClassDeclaration:exit"(node) {
        if (currentComponent?.node !== node) {
          return;
        }

        for (const [
          name,
          propNode,
        ] of currentComponent.trackedProps.entries()) {
          const reassigned = currentComponent.assigned.has(name);

          if (!reassigned && !mutUses.has(name)) {
            context.report({
              node: propNode,
              message: `\`${name}\` property is defined as tracked but isn't modified anywhere.`,
            });
          }
        }

        currentComponent = null;
      },

      "ClassExpression:exit"(node) {
        if (currentComponent?.node !== node) {
          return;
        }

        for (const [
          name,
          propNode,
        ] of currentComponent.trackedProps.entries()) {
          const reassigned = currentComponent.assigned.has(name);

          if (!reassigned && !mutUses.has(name)) {
            context.report({
              node: propNode,
              message: `\`${name}\` property is defined as tracked but isn't modified anywhere.`,
            });
          }
        }

        currentComponent = null;
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
