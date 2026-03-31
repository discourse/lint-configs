import { collectImports } from "./utils/analyze-imports.mjs";
import { fixImport } from "./utils/fix-import.mjs";

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

function buildNamingConflictMessage(specifier) {
  const oldName = specifier.imported.name;
  const newName = SPECIFIER_MAPPING[oldName];

  return (
    `Use \`${newName}\` from '${NEW_SOURCE}' instead of \`${oldName}\`:` +
    ` \`${newName}\` conflicts with an existing binding. Rename the conflicting identifier first.`
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

/**
 * Checks whether the new function name for a specifier would conflict with
 * an existing binding in the module scope (excluding the old import itself).
 *
 * @param {import('estree').ImportSpecifier} specifier
 * @param {import('eslint').Scope.Scope} moduleScope
 * @returns {boolean}
 */
function hasNamingConflict(specifier, moduleScope) {
  // Aliased imports won't introduce a new name — the alias stays the same
  if (specifier.local.name !== specifier.imported.name) {
    return false;
  }

  const newName = SPECIFIER_MAPPING[specifier.imported.name];
  const variable = moduleScope?.variables.find((v) => v.name === newName);

  // No variable with that name exists — no conflict
  if (!variable) {
    return false;
  }

  // If the variable's only definition is an import from one of the old sources,
  // that's the import we're replacing — not a real conflict
  const isFromOldImport = variable.defs.every(
    (def) =>
      def.type === "ImportBinding" && OLD_SOURCES.has(def.parent?.source?.value)
  );

  return !isFromOldImport;
}

/**
 * Looks up the local name already used for a given new specifier name in the
 * existing import from NEW_SOURCE. Returns the alias if found, or null.
 *
 * @param {string} newName - The new imported name (e.g. "trackedArray")
 * @param {object|undefined} existingImportInfo - From collectImports
 * @returns {string|null} The local alias, or null if not already imported
 */
function getExistingLocalName(newName, existingImportInfo) {
  if (!existingImportInfo) {
    return null;
  }

  const spec = existingImportInfo.specifiers.find(
    (s) => s.type === "ImportSpecifier" && s.imported.name === newName
  );

  return spec ? spec.local.name : null;
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

        const imports = collectImports(context.sourceCode);
        const existingNewSourceImport = imports.get(NEW_SOURCE);

        // Classify each specifier as fixable or unfixable
        const fixable = [];
        const unfixable = [];
        const nonNewRefs = [];
        const namingConflicts = [];

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

          // Check naming conflicts only for specifiers that would otherwise
          // be fixable and that don't already exist in the new source import
          if (specifierIsFixable) {
            const newName = SPECIFIER_MAPPING[specifier.imported.name];
            const alreadyImported = getExistingLocalName(
              newName,
              existingNewSourceImport
            );

            if (!alreadyImported && hasNamingConflict(specifier, moduleScope)) {
              specifierIsFixable = false;
              namingConflicts.push(specifier);
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

                if (existingNewSourceImport) {
                  // Merge into existing import from NEW_SOURCE
                  const specifiersToAdd = [];

                  for (const specifier of fixable) {
                    const newName = SPECIFIER_MAPPING[specifier.imported.name];
                    const alreadyImported = getExistingLocalName(
                      newName,
                      existingNewSourceImport
                    );

                    if (!alreadyImported) {
                      specifiersToAdd.push(buildNewSpecifier(specifier));
                    }
                  }

                  // Add new specifiers to the existing import
                  if (specifiersToAdd.length > 0) {
                    fixes.push(
                      fixImport(fixer, existingNewSourceImport.node, {
                        namedImportsToAdd: specifiersToAdd,
                      })
                    );
                  }

                  // Remove or trim the old import
                  if (keepOnOld.length === 0) {
                    fixes.push(fixer.remove(node));
                  } else {
                    fixes.push(
                      fixer.replaceText(
                        node,
                        `import { ${keepOnOld.join(", ")} } from "${oldSource}";`
                      )
                    );
                  }
                } else if (keepOnOld.length === 0) {
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

                  // Determine the name to use at call sites — if the new
                  // source already imports this with an alias, use that alias
                  const existingLocal = getExistingLocalName(
                    newFunctionName,
                    existingNewSourceImport
                  );
                  const callSiteName = existingLocal || newFunctionName;

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

                      // Rename identifier to the correct call-site name
                      if (existingLocal) {
                        // Use the alias from the existing import
                        fixes.push(
                          fixer.replaceText(ref.identifier, existingLocal)
                        );
                      } else if (!isAliased) {
                        fixes.push(
                          fixer.replaceText(ref.identifier, callSiteName)
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

        // Report on each naming conflict
        for (const specifier of namingConflicts) {
          context.report({
            node: specifier,
            message: buildNamingConflictMessage(specifier),
          });
        }
      },
    };
  },
};
