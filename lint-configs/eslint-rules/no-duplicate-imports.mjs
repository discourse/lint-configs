import { buildImportStatement } from "./utils/fix-import.mjs";

const MERGE_MESSAGE =
  "`{{source}}` is imported more than once: merge the imports into a single statement";

export default {
  meta: {
    type: "problem",
    docs: {
      description: "disallow importing the same module more than once",
    },
    fixable: "code",
    schema: [],
    messages: {
      duplicate: `${MERGE_MESSAGE}.`,
      duplicateManual: `${MERGE_MESSAGE} manually (a namespace or conflicting default import prevents an automatic fix).`,
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const groups = new Map();

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        let declarations = groups.get(source);
        if (!declarations) {
          groups.set(source, (declarations = []));
        }
        declarations.push(node);
      },

      "Program:exit"() {
        for (const declarations of groups.values()) {
          if (declarations.length > 1) {
            reportDuplicateGroup(context, sourceCode, declarations);
          }
        }
      },
    };
  },
};

function reportDuplicateGroup(context, sourceCode, declarations) {
  const [first, ...rest] = declarations;
  const source = first.source.value;
  const merged = mergeSpecifiers(declarations);

  rest.forEach((node, index) => {
    context.report({
      node,
      messageId: merged ? "duplicate" : "duplicateManual",
      data: { source },
      // One fix collapses the whole group; attach it once to avoid overlaps.
      fix:
        merged && index === 0
          ? (fixer) => [
              fixer.replaceText(first, merged),
              ...rest.map((duplicate) =>
                removeStatement(fixer, sourceCode, duplicate)
              ),
            ]
          : undefined,
    });
  });
}

// Returns the merged import statement, or null when it can't be expressed as one.
function mergeSpecifiers(declarations) {
  const defaultNames = new Set();
  const namedImports = new Set();
  let hasNamespace = false;
  let hasUnsupportedSpecifier = false;

  for (const declaration of declarations) {
    for (const specifier of declaration.specifiers) {
      switch (specifier.type) {
        case "ImportDefaultSpecifier":
          defaultNames.add(specifier.local.name);
          break;
        case "ImportNamespaceSpecifier":
          hasNamespace = true;
          break;
        case "ImportSpecifier":
          if (specifier.imported.type !== "Identifier") {
            hasUnsupportedSpecifier = true;
            break;
          }
          namedImports.add(
            specifier.imported.name === specifier.local.name
              ? specifier.local.name
              : `${specifier.imported.name} as ${specifier.local.name}`
          );
          break;
      }
    }
  }

  if (hasNamespace || hasUnsupportedSpecifier || defaultNames.size > 1) {
    return null;
  }

  const source = declarations[0].source.value;

  if (defaultNames.size === 0 && namedImports.size === 0) {
    return `import "${source}";`;
  }

  return buildImportStatement(source, {
    defaultImport: defaultNames.size === 1 ? [...defaultNames][0] : null,
    namedImports: [...namedImports],
  });
}

function removeStatement(fixer, sourceCode, node) {
  const text = sourceCode.text;
  let end = node.range[1];

  while (end < text.length && (text[end] === " " || text[end] === "\t")) {
    end++;
  }
  if (text[end] === "\r") {
    end++;
  }
  if (text[end] === "\n") {
    end++;
  }

  return fixer.removeRange([node.range[0], end]);
}
