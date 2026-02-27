const SPECIFIER_MAPPING = {
  TrackedArray: "trackedArray",
  TrackedObject: "trackedObject",
  TrackedMap: "trackedMap",
  TrackedSet: "trackedSet",
  TrackedWeakMap: "trackedWeakMap",
  TrackedWeakSet: "trackedWeakSet",
};

const OLD_SOURCES = new Set([
  "@ember-compat/tracked-built-ins",
  "tracked-built-ins",
]);
const NEW_SOURCE = "@ember/reactive/collections";

function buildImportMessage(specifiersToTransform, oldSource) {
  const oldNames = specifiersToTransform.map((s) => s.imported.name);
  const newNames = oldNames.map((n) => SPECIFIER_MAPPING[n]);

  const oldList = oldNames.map((n) => `'${n}'`).join(", ");
  const newList = newNames.map((n) => `'${n}'`).join(", ");

  const usageNotes = specifiersToTransform
    .map((s) => {
      const newName = SPECIFIER_MAPPING[s.imported.name];
      const localName = s.local.name;
      const callName = localName === s.imported.name ? newName : localName;
      return `${callName}() instead of new ${localName}()`;
    })
    .join(", ");

  return (
    `Use ${newList} from '${NEW_SOURCE}' instead of ${oldList} from '${oldSource}'.` +
    ` Note: use ${usageNotes}.`
  );
}

function buildNonNewMessage(specifier) {
  const oldName = specifier.imported.name;
  const newName = SPECIFIER_MAPPING[oldName];

  return (
    `'${oldName}' must be migrated to '${NEW_SOURCE}', but this usage requires manual review.` +
    ` The new module exports '${newName}' as a factory function, not a class,` +
    ` so 'instanceof', class references, etc. will not work the same way.`
  );
}

function isNewExpression(ref) {
  const parent = ref.identifier.parent;
  return parent.type === "NewExpression" && parent.callee === ref.identifier;
}

function buildNewSpecifier(specifier) {
  const oldName = specifier.imported.name;
  const localName = specifier.local.name;
  const newName = SPECIFIER_MAPPING[oldName] || oldName;

  if (localName === oldName) {
    return newName;
  }
  return `${newName} as ${localName}`;
}

function buildOldSpecifier(specifier) {
  const oldName = specifier.imported.name;
  const localName = specifier.local.name;

  if (localName === oldName) {
    return oldName;
  }
  return `${oldName} as ${localName}`;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Replace imports from '@ember-compat/tracked-built-ins' and 'tracked-built-ins'" +
        ` with '${NEW_SOURCE}'`,
    },
    fixable: "code",
    schema: [],
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const oldSource = node.source.value;

        if (!OLD_SOURCES.has(oldSource)) {
          return;
        }

        const specifiersToTransform = node.specifiers.filter(
          (s) =>
            s.type === "ImportSpecifier" && SPECIFIER_MAPPING[s.imported.name]
        );

        // Report on `tracked` import separately — it's likely confused with
        // @glimmer/tracking's `tracked` decorator. There's no auto-fix since
        // the replacement depends on usage context.
        const trackedSpecifier = node.specifiers.find(
          (s) => s.type === "ImportSpecifier" && s.imported.name === "tracked"
        );

        if (trackedSpecifier) {
          context.report({
            node: trackedSpecifier,
            message:
              `'tracked' should not be imported from '${oldSource}'.` +
              ` Use '@glimmer/tracking' for the @tracked decorator,` +
              ` or use the specific factory functions from '${NEW_SOURCE}'` +
              ` (e.g. trackedArray(), trackedMap(), trackedObject()).`,
          });
        }

        if (specifiersToTransform.length === 0) {
          return;
        }

        const moduleScope = context.sourceCode.scopeManager.scopes.find(
          (s) => s.type === "module"
        );

        // Classify each specifier as fixable or unfixable
        const fixable = [];
        const unfixable = [];
        const nonNewRefs = [];

        for (const specifier of specifiersToTransform) {
          const variable = moduleScope?.variables.find(
            (v) => v.name === specifier.local.name
          );

          let specifierIsFixable = true;

          if (variable) {
            for (const ref of variable.references) {
              if (!isNewExpression(ref)) {
                specifierIsFixable = false;
                nonNewRefs.push({ ref, specifier });
              }
            }
          }

          if (specifierIsFixable) {
            fixable.push(specifier);
          } else {
            unfixable.push(specifier);
          }
        }

        const hasFix = fixable.length > 0;

        // Specifiers not in SPECIFIER_MAPPING (e.g. `tracked`) that must stay
        // on the old import if we split
        const unmappedSpecifiers = node.specifiers.filter(
          (s) =>
            s.type === "ImportSpecifier" && !SPECIFIER_MAPPING[s.imported.name]
        );

        // Report on import node
        context.report({
          node,
          message: buildImportMessage(specifiersToTransform, oldSource),
          fix: hasFix
            ? (fixer) => {
                const fixes = [];
                const keepOnOld = [
                  ...unfixable.map(buildOldSpecifier),
                  ...unmappedSpecifiers.map(buildOldSpecifier),
                ];

                if (keepOnOld.length === 0) {
                  // All fixable: replace entire import with new source
                  const newSpecifiers =
                    specifiersToTransform.map(buildNewSpecifier);

                  fixes.push(
                    fixer.replaceText(
                      node,
                      `import { ${newSpecifiers.join(", ")} } from "${NEW_SOURCE}";`
                    )
                  );
                } else {
                  // Partial fix: split into two imports
                  const newSpecifiers = fixable.map(buildNewSpecifier);

                  fixes.push(
                    fixer.replaceText(
                      node,
                      `import { ${keepOnOld.join(", ")} } from "${oldSource}";\n` +
                        `import { ${newSpecifiers.join(", ")} } from "${NEW_SOURCE}";`
                    )
                  );
                }

                // Fix usage sites for fixable specifiers
                for (const specifier of fixable) {
                  const localName = specifier.local.name;
                  const isAliased = localName !== specifier.imported.name;
                  const newFunctionName =
                    SPECIFIER_MAPPING[specifier.imported.name];

                  const variable = moduleScope?.variables.find(
                    (v) => v.name === localName
                  );
                  if (!variable) {
                    continue;
                  }

                  for (const ref of variable.references) {
                    const parent = ref.identifier.parent;

                    if (
                      parent.type === "NewExpression" &&
                      parent.callee === ref.identifier
                    ) {
                      // Remove `new ` keyword
                      fixes.push(
                        fixer.removeRange([
                          parent.range[0],
                          parent.callee.range[0],
                        ])
                      );

                      // Rename identifier if not aliased
                      if (!isAliased) {
                        fixes.push(
                          fixer.replaceText(ref.identifier, newFunctionName)
                        );
                      }
                    }
                  }
                }

                return fixes;
              }
            : null,
        });

        // Report on each non-new reference
        for (const { ref, specifier } of nonNewRefs) {
          context.report({
            node: ref.identifier,
            message: buildNonNewMessage(specifier),
          });
        }
      },
    };
  },
};
