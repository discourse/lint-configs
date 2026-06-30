import { buildImportStatement } from "./utils/fix-import.mjs";

export default {
  meta: {
    type: "problem",
    docs: {
      description: "disallow importing the same module more than once",
    },
    fixable: "code",
    schema: [],
    messages: {
      duplicate:
        "`{{source}}` is imported more than once: merge the imports into a single statement.",
      duplicateManual:
        "`{{source}}` is imported more than once: merge the imports into a single statement manually.",
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
          reportDuplicateGroup(context, sourceCode, declarations);
        }
      },
    };
  },
};

function reportDuplicateGroup(context, sourceCode, declarations) {
  // A namespace import can't be combined with anything, so only count plain
  // default/named statements as mergeable duplicates and leave the rest alone.
  const combinable = declarations.filter(
    (declaration) =>
      !declaration.specifiers.some(
        (specifier) => specifier.type === "ImportNamespaceSpecifier"
      )
  );

  if (combinable.length < 2) {
    return;
  }

  const [first, ...rest] = combinable;
  const source = first.source.value;
  // null when the combinable statements still can't merge (e.g. two default
  // names); those are reported without a fix.
  const merged = mergeSpecifiers(combinable);

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
  let hasUnsupportedSpecifier = false;

  for (const declaration of declarations) {
    for (const specifier of declaration.specifiers) {
      if (specifier.type === "ImportDefaultSpecifier") {
        defaultNames.add(specifier.local.name);
      } else if (specifier.imported.type !== "Identifier") {
        hasUnsupportedSpecifier = true;
      } else {
        namedImports.add(
          specifier.imported.name === specifier.local.name
            ? specifier.local.name
            : `${specifier.imported.name} as ${specifier.local.name}`
        );
      }
    }
  }

  if (hasUnsupportedSpecifier || defaultNames.size > 1) {
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
