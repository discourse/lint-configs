import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

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

function isWithin(parent, path) {
  return path === parent || path.startsWith(parent + sep);
}

const themeRoots = new Map();

/**
 * The nearest ancestor directory holding a theme's `about.json`, or null.
 *
 * @param {string} dir
 * @returns {string | null}
 */
function themeRootOf(dir) {
  if (!themeRoots.has(dir)) {
    const parent = dirname(dir);
    let root = null;
    if (existsSync(join(dir, "about.json"))) {
      root = dir;
    } else if (parent !== dir) {
      root = themeRootOf(parent);
    }
    themeRoots.set(dir, root);
  }
  return themeRoots.get(dir);
}

/**
 * Where a theme import resolves. Theme modules are named after the theme's layout, not its
 * files: `javascripts/<path>` is the module `<path>`, and `test/<path>` stays `test/<path>`,
 * so a theme test reaches `javascripts/discourse/x.gjs` as `../../discourse/x.gjs`.
 *
 * @param {string} importer
 * @param {string} specifier
 * @returns {string | null}
 */
function themeTarget(importer, specifier) {
  const root = themeRootOf(dirname(importer));
  if (!root) {
    return null;
  }

  const scripts = join(root, "javascripts");
  const importerDir = dirname(importer);
  const moduleDir = isWithin(scripts, importerDir)
    ? join(root, relative(scripts, importerDir))
    : importerDir;
  const moduleTarget = resolve(moduleDir, specifier);
  const fromRoot = relative(root, moduleTarget);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    return null;
  }

  return isWithin("test", fromRoot) ? moduleTarget : join(scripts, fromRoot);
}

/**
 * The paths a relative specifier may refer to: on disk, then through a theme's layout.
 *
 * @param {string} importer
 * @param {string} specifier
 * @returns {string[]}
 */
function candidateTargets(importer, specifier) {
  const onDisk = resolve(dirname(importer), specifier);
  const inTheme = themeTarget(importer, specifier);
  return inTheme && inTheme !== onDisk ? [onDisk, inTheme] : [onDisk];
}

function withSourceExtension(target, specifier) {
  const fileExt = SOURCE_EXTENSIONS.find((ext) => isFile(target + ext));
  if (fileExt) {
    return specifier + fileExt;
  }

  const indexExt = SOURCE_EXTENSIONS.find((ext) =>
    isFile(resolve(target, `index${ext}`))
  );
  if (indexExt) {
    return `${specifier.replace(/\/$/, "")}/index${indexExt}`;
  }

  return null;
}

function withSiblingExtension(target, specifier, ext) {
  const base = target.slice(0, -ext.length);
  const sibling = SOURCE_EXTENSIONS.find(
    (other) => other !== ext && isFile(base + other)
  );
  return sibling ? specifier.slice(0, -ext.length) + sibling : null;
}

function firstResult(targets, resolveTarget) {
  for (const target of targets) {
    const result = resolveTarget(target);
    if (result) {
      return result;
    }
  }
  return null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require relative imports to name an existing file with its extension, e.g. `./foo.gjs` or `./foo/index.js`.",
    },
    fixable: "code",
    messages: {
      useExtension: `Use \`{{fixed}}\` instead of \`{{specifier}}\`: ${MUST_INCLUDE_EXTENSION}.`,
      addExtension: `Add the file extension to \`{{specifier}}\`: ${MUST_INCLUDE_EXTENSION}.`,
      replaceExtension:
        "Use `{{fixed}}` instead of `{{specifier}}`: no file exists at `{{specifier}}`.",
      missingFile:
        "Point `{{specifier}}` at an existing file: nothing exists at that path.",
    },
    schema: [], // no options
  },

  create(context) {
    function report(node, messageId, specifier, fixed) {
      const quote = node.raw[0];
      context.report({
        node,
        messageId,
        data: { specifier, fixed },
        ...(fixed && {
          fix: (fixer) => fixer.replaceText(node, `${quote}${fixed}${quote}`),
        }),
      });
    }

    function checkMissingExtension(node, specifier, targets) {
      const fixed = firstResult(targets, (target) =>
        withSourceExtension(target, specifier)
      );
      report(node, fixed ? "useExtension" : "addExtension", specifier, fixed);
    }

    // A file renamed to another source extension (`x.gjs` -> `x.gts`) leaves importers
    // that still name the old one; they pass type checks and fail at runtime.
    function checkMissingFile(node, specifier, ext, targets) {
      // TypeScript resolves `./x.js` to `x.ts`, typically a compiled output
      if (
        ext === ".js" &&
        targets.some((target) => isFile(target.slice(0, -3) + ".ts"))
      ) {
        return;
      }

      const fixed = firstResult(targets, (target) =>
        withSiblingExtension(target, specifier, ext)
      );
      report(
        node,
        fixed ? "replaceExtension" : "missingFile",
        specifier,
        fixed
      );
    }

    function check(node) {
      if (node?.type !== "Literal" || typeof node.value !== "string") {
        return;
      }

      const specifier = node.value;
      if (!specifier.startsWith(".") || specifier.includes("?")) {
        return;
      }

      const targets = candidateTargets(context.filename, specifier);
      if (targets.some(isFile)) {
        return;
      }

      const sourceExt = SOURCE_EXTENSIONS.find((ext) =>
        specifier.endsWith(ext)
      );
      if (sourceExt) {
        checkMissingFile(node, specifier, sourceExt, targets);
      } else if (!hasKnownExtension(specifier)) {
        checkMissingExtension(node, specifier, targets);
      }
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
