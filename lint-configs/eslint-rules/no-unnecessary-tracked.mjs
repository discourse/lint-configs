const MUTATING_COMPONENTS = ["Input", "TextField", "Textarea"];

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
    const selectKitComponents = new Set();
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
      if (!currentComponent || !node.path?.head) {
        return;
      }

      if (node.path.head.type !== "VarHead" || node.path.head.name !== "mut") {
        return;
      }

      const firstParam = node.params?.[0];
      if (firstParam.type !== "GlimmerPathExpression") {
        return;
      }

      if (firstParam.head.type === "ThisHead" && firstParam.tail.length) {
        currentComponent.mutUses.add(firstParam.tail[0]);
      }
    }

    function handleGlimmerElementNode(node) {
      if (!currentComponent) {
        return;
      }

      const componentName = node.tag || node.name;
      if (
        !componentName ||
        (!MUTATING_COMPONENTS.includes(componentName) &&
          !selectKitComponents.has(componentName))
      ) {
        return;
      }

      const valueAttr = node.attributes?.find(
        (attr) => attr.type === "GlimmerAttrNode" && attr.name === "@value"
      );
      if (!valueAttr?.value || valueAttr.value.type !== "GlimmerMustacheStatement") {
        return;
      }

      const path = valueAttr.value.path;
      if (path?.type === "GlimmerPathExpression") {
        if (path.head?.type === "ThisHead" && path.tail?.length) {
          currentComponent.valueUses.add(path.tail[0]);
        }
      }
    }

    function handleClass(node) {
      if (isComponentClass(node, componentNames)) {
        currentComponent = {
          node,
          trackedProps: new Map(),
          assigned: new Set(),
          mutUses: new Set(),
          valueUses: new Set(),
        };
      }
    }

    function handleClassExit(node) {
      if (currentComponent?.node !== node) {
        return;
      }

      for (const [name, propNode] of currentComponent.trackedProps.entries()) {
        const reassigned = currentComponent.assigned.has(name);
        const hasMutUse = currentComponent.mutUses.has(name);
        const hasValueUse = currentComponent.valueUses.has(name);

        if (!reassigned && !hasMutUse && !hasValueUse) {
          context.report({
            node: propNode,
            message: `\`${name}\` property is defined as tracked but isn't modified anywhere.`,
          });
        }
      }

      currentComponent = null;
    }

    return {
      ImportDeclaration(node) {
        if (node.source.value?.includes("/select-kit/")) {
          node.specifiers.forEach((specifier) => {
            if (specifier.local?.name) {
              selectKitComponents.add(specifier.local.name);
            }
          });
        }

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

      ClassDeclaration: handleClass,
      ClassExpression: handleClass,

      "ClassDeclaration:exit": handleClassExit,
      "ClassExpression:exit": handleClassExit,

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
      GlimmerElementNode: handleGlimmerElementNode,
    };
  },
};
