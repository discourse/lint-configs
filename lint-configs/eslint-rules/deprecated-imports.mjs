/**
 * Builds a fix that renames an imported specifier to `newName`. When the import
 * isn't aliased, the fix also renames every reference to it.
 *
 * The fix is skipped when `newName` is already bound where a renamed identifier
 * would land: in the module, the rename would declare the name twice, and in an
 * inner scope, it would point the reference at a different variable.
 *
 * @param {import("eslint").Rule.RuleContext} context - The rule context.
 * @param {string} newName - The name to rename the import to.
 * @returns {(fixer: import("eslint").Rule.RuleFixer, specifier: import("estree").ImportSpecifier) => import("eslint").Rule.Fix[] | null}
 *   The fix function, which returns `null` when renaming isn't safe.
 */
function renameImport(context, newName) {
  return (fixer, specifier) => {
    const fixes = [fixer.replaceText(specifier.imported, newName)];

    if (specifier.local.name !== specifier.imported.name) {
      return fixes;
    }

    const [variable] = context.sourceCode.getDeclaredVariables(specifier);
    if (!variable) {
      return fixes;
    }

    if (variable.scope.set.has(newName)) {
      return null;
    }

    for (const ref of variable.references) {
      for (
        let scope = ref.from;
        scope && scope !== variable.scope;
        scope = scope.upper
      ) {
        if (scope.set.has(newName)) {
          return null;
        }
      }

      if (ref.identifier !== specifier.local) {
        fixes.push(fixer.replaceText(ref.identifier, newName));
      }
    }

    return fixes;
  };
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Use the correct import paths",
    },
    fixable: "code",
    schema: [], // no options
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        function denyImporting(symbolName, messageTemplate, fixFn) {
          const specifier = node.specifiers.find(
            (spec) => spec.imported && spec.imported.name === symbolName
          );

          if (specifier) {
            context.report({
              node: specifier,
              message: messageTemplate(symbolName),
              fix: fixFn ? (fixer) => fixFn(fixer, specifier) : undefined,
            });
          }
        }

        function denyDefaultImport(message) {
          const defaultSpecifier = node.specifiers.find(
            (spec) => spec.type === "ImportDefaultSpecifier"
          );

          if (defaultSpecifier) {
            context.report({
              node: defaultSpecifier,
              message,
            });
          }
        }

        if (node.source.value === "discourse/helpers/get-url") {
          context.report({
            node,
            message:
              "Use 'discourse/lib/get-url' instead of 'discourse/helpers/get-url'",
            fix(fixer) {
              return fixer.replaceText(node.source, `"discourse/lib/get-url"`);
            },
          });
        } else if (node.source.value === "discourse/lib/transformer/registry") {
          context.report({
            node,
            message:
              "Use 'discourse/lib/registry/transformers' instead of 'discourse/lib/transformer/registry'",
            fix(fixer) {
              return fixer.replaceText(
                node.source,
                `"discourse/lib/registry/transformers"`
              );
            },
          });
        } else if (
          node.source.value === "discourse/helpers/html-safe" &&
          node.specifiers[0]?.local.name === "htmlSafe"
        ) {
          context.report({
            node,
            message:
              "Use '@ember/template' instead of 'discourse/helpers/html-safe'",
            fix(fixer) {
              return fixer.replaceText(
                node,
                `import { trustHTML } from "@ember/template";`
              );
            },
          });
        } else if (
          node.source.value === "@ember/application" &&
          node.specifiers[0]?.local.name === "getOwner"
        ) {
          context.report({
            node,
            message:
              "Use '@ember/owner' instead of '@ember/application' to import 'getOwner'",
            fix(fixer) {
              return fixer.replaceText(
                node,
                `import { getOwner } from "@ember/owner";`
              );
            },
          });
        } else if (node.source.value === "@ember/template") {
          denyImporting(
            "htmlSafe",
            () =>
              "'htmlSafe' is deprecated. Use 'trustHTML' from '@ember/template' instead.",
            renameImport(context, "trustHTML")
          );
          denyImporting(
            "isHTMLSafe",
            () =>
              "'isHTMLSafe' is deprecated. Use 'isTrustedHTML' from '@ember/template' instead.",
            renameImport(context, "isTrustedHTML")
          );
        } else if (node.source.value === "@ember/array") {
          const messageTemplate = (symbolName) =>
            `Importing '${symbolName}' from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead.`;

          denyImporting("A", messageTemplate);
          denyImporting("NativeArray", messageTemplate);
          denyImporting("MutableArray", messageTemplate);

          denyDefaultImport(
            "Importing EmberArray (default) from '@ember/array' is deprecated. Use tracked arrays or native JavaScript arrays instead."
          );
        } else if (node.source.value === "@ember/array/mutable") {
          denyDefaultImport(
            "Importing MutableArray (default) from '@ember/array/mutable' is deprecated. Use tracked arrays or native JavaScript arrays instead."
          );
        } else if (node.source.value === "@ember/array/proxy") {
          denyDefaultImport(
            "Importing ArrayProxy (default) from '@ember/array/proxy' is deprecated. Use tracked arrays or native JavaScript arrays instead."
          );
        } else if (node.source.value === "discourse/lib/tracked-tools") {
          denyImporting(
            "trackedArray",
            () =>
              "'trackedArray' is deprecated. Use 'autoTrackedArray' from 'discourse/lib/tracked-tools' instead.",
            renameImport(context, "autoTrackedArray")
          );
        }
      },
    };
  },
};
