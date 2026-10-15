import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SOURCE_EXTENSIONS = [".ts", ".js", ".gts", ".gjs"];
const KNOWN_EXTENSIONS = [
  ...SOURCE_EXTENSIONS,
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".json",
  ".css",
  ".scss",
  ".hbs",
  ".wasm",
];

const MUST_INCLUDE_EXTENSION =
  "relative imports must include the file extension";

function isFile(path) {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

function hasKnownExtension(specifier) {
  return KNOWN_EXTENSIONS.some((ext) => specifier.endsWith(ext));
}

function resolveWithExtension(importer, specifier) {
  const target = resolve(dirname(importer), specifier);

  for (const ext of SOURCE_EXTENSIONS) {
    if (isFile(target + ext)) {
      return specifier + ext;
    }
  }

  for (const ext of SOURCE_EXTENSIONS) {
    if (isFile(resolve(target, `index${ext}`))) {
      return `${specifier.replace(/\/$/, "")}/index${ext}`;
    }
  }

  return null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require relative imports to include the file extension, e.g. `./foo.gjs` or `./foo/index.js`.",
    },
    fixable: "code",
    messages: {
      useExtension: `Use \`{{fixed}}\` instead of \`{{specifier}}\`: ${MUST_INCLUDE_EXTENSION}.`,
      addExtension: `Add the file extension to \`{{specifier}}\`: ${MUST_INCLUDE_EXTENSION}.`,
    },
    schema: [], // no options
  },

  create(context) {
    function check(node) {
      if (node?.type !== "Literal" || typeof node.value !== "string") {
        return;
      }

      const specifier = node.value;
      if (
        !specifier.startsWith(".") ||
        specifier.includes("?") ||
        hasKnownExtension(specifier) ||
        isFile(resolve(dirname(context.filename), specifier))
      ) {
        return;
      }

      const fixed = resolveWithExtension(context.filename, specifier);
      if (!fixed) {
        context.report({
          node,
          messageId: "addExtension",
          data: { specifier },
        });
        return;
      }

      const quote = node.raw[0];
      context.report({
        node,
        messageId: "useExtension",
        data: { specifier, fixed },
        fix: (fixer) => fixer.replaceText(node, `${quote}${fixed}${quote}`),
      });
    }

    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "importSync"
        ) {
          check(node.arguments[0]);
        }
      },
    };
  },
};
