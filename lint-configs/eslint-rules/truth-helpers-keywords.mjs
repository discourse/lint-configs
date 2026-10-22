import { fixImport } from "./utils/fix-import.mjs";

const TRUTH_HELPERS_SOURCES = new Set([
  "discourse/truth-helpers",
  "truth-helpers",
]);

// Truth helpers that Ember provides as built-in template keywords.
const KEYWORDS = new Map([
  ["and", "and"],
  ["eq", "eq"],
  ["gt", "gt"],
  ["gte", "gte"],
  ["lt", "lt"],
  ["lte", "lte"],
  ["not", "not"],
  ["notEq", "neq"],
  ["or", "or"],
]);

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Use Ember's built-in template keywords instead of importing truth helpers",
    },
    fixable: "code",
    schema: [], // no options
    messages: {
      useKeyword:
        "Use the built-in `{{keyword}}` template keyword instead of importing `{{name}}`.",
    },
  },

  create(context) {
    const { sourceCode } = context;

    return {
      ImportDeclaration(node) {
        if (!TRUTH_HELPERS_SOURCES.has(node.source.value)) {
          return;
        }

        const removable = node.specifiers.filter(
          (s) => s.type === "ImportSpecifier" && KEYWORDS.has(s.imported.name)
        );

        function fix(fixer) {
          const fixes = [
            fixImport(fixer, node, {
              namedImportsToRemove: removable.map((s) => s.imported.name),
            }),
          ];

          for (const specifier of removable) {
            const keyword = KEYWORDS.get(specifier.imported.name);
            if (specifier.local.name !== keyword) {
              const [variable] = sourceCode.getDeclaredVariables(specifier);
              for (const ref of variable.references) {
                fixes.push(fixer.replaceText(ref.identifier, keyword));
              }
            }
          }

          return fixes;
        }

        for (const specifier of removable) {
          context.report({
            node: specifier,
            messageId: "useKeyword",
            data: {
              keyword: KEYWORDS.get(specifier.imported.name),
              name: specifier.local.name,
            },
            fix,
          });
        }
      },
    };
  },
};
