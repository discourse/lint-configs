import fs from "node:fs";
import path from "node:path";

// Matches `discourse/plugins/<name>` and `discourse/plugins/<name>/...`,
// capturing the plugin name.
const PLUGIN_MODULE_REGEX = /^discourse\/plugins\/([^/]+)/;

// Plugin metadata frontmatter, e.g. `# name: discourse-activity-pub`. This is
// the name used in `discourse/plugins/<name>` specifiers, which can differ from
// the plugin's directory name.
const PLUGIN_NAME_REGEX = /^#\s*name:\s*(.+?)\s*$/m;

const VALID_MODES = ["optional", "required"];

const ATTRIBUTE_NAME = "discoursePlugin";

// Flat-config filenames that mark a project root. The upward search stops here
// rather than walking all the way to the filesystem root.
const ESLINT_CONFIG_FILES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
];

// Maps a directory to the name of the plugin it belongs to (or null), memoised
// so we read each `plugin.rb` at most once per process.
const pluginNameByDir = new Map();

function pluginNameForDir(dir) {
  if (pluginNameByDir.has(dir)) {
    return pluginNameByDir.get(dir);
  }

  let entries = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    // Unreadable directory — give up.
  }

  let name = null;
  if (entries.includes("plugin.rb")) {
    // Found the plugin root; read its declared name.
    const contents = fs.readFileSync(path.join(dir, "plugin.rb"), "utf8");
    name = contents.match(PLUGIN_NAME_REGEX)?.[1] ?? null;
  } else if (!entries.some((entry) => ESLINT_CONFIG_FILES.includes(entry))) {
    // Not a plugin root and not the project root — keep looking upward, unless
    // we've reached the filesystem root.
    const parent = path.dirname(dir);
    if (parent !== dir) {
      name = pluginNameForDir(parent);
    }
  }
  // Otherwise we hit an ESLint config with no adjacent `plugin.rb`: this is the
  // project boundary, so stop here with no current plugin.

  pluginNameByDir.set(dir, name);
  return name;
}

// The current plugin is the one whose `plugin.rb` sits alongside the running
// ESLint config — i.e. the nearest `plugin.rb` above the file being linted.
function currentPluginName(context) {
  if (!context.filename) {
    return null;
  }

  return pluginNameForDir(
    path.dirname(path.resolve(context.cwd, context.filename))
  );
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a `discoursePlugin` import attribute on cross-plugin imports, and forbid it on imports of the current plugin.",
    },
    fixable: "code",
    schema: [],
    messages: {
      missingAttribute: `Add \`with { ${ATTRIBUTE_NAME}: "optional" }\` (or \`"required"\`) to this cross-plugin import so its optionality is explicit.`,
      invalidValue: `\`${ATTRIBUTE_NAME}\` must be "optional" or "required", not "{{value}}".`,
      unexpectedAttribute: `Remove the \`${ATTRIBUTE_NAME}\` attribute: this imports the current plugin (\`{{plugin}}\`), not another one.`,
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;

    // Resolved lazily (and only once) on the first `discourse/plugins/...`
    // import, so files without any never touch the filesystem. The resolver
    // returns a string or null, so `undefined` means "not yet resolved".
    let currentPlugin;
    const getCurrentPlugin = () => {
      if (currentPlugin === undefined) {
        currentPlugin = currentPluginName(context);
      }
      return currentPlugin;
    };

    return {
      ImportDeclaration(node) {
        const match = node.source.value.match(PLUGIN_MODULE_REGEX);
        if (!match) {
          return;
        }

        const importedPlugin = match[1];
        const attribute = node.attributes?.find(
          (a) => (a.key.name ?? a.key.value) === ATTRIBUTE_NAME
        );

        if (importedPlugin === getCurrentPlugin()) {
          // Importing the current plugin's own modules — the attribute is
          // meaningless here and must not be present.
          if (attribute) {
            context.report({
              node: attribute,
              messageId: "unexpectedAttribute",
              data: { plugin: getCurrentPlugin() },
              fix: (fixer) =>
                fixer.removeRange([
                  node.source.range[1],
                  closingBraceAfter(sourceCode, node).range[1],
                ]),
            });
          }
          return;
        }

        // Importing another plugin — the attribute is required.
        if (!attribute) {
          // Only auto-add when there is no existing `with { ... }` clause to
          // merge into; otherwise just report.
          const hasOtherAttributes = node.attributes?.length > 0;
          context.report({
            node,
            messageId: "missingAttribute",
            fix: hasOtherAttributes
              ? undefined
              : (fixer) =>
                  fixer.insertTextAfter(
                    node.source,
                    ` with { ${ATTRIBUTE_NAME}: "optional" }`
                  ),
          });
          return;
        }

        if (!VALID_MODES.includes(attribute.value.value)) {
          context.report({
            node: attribute,
            messageId: "invalidValue",
            data: { value: attribute.value.value },
          });
        }
      },
    };
  },
};

// The `}` that closes the `with { ... }` attributes clause.
function closingBraceAfter(sourceCode, node) {
  const lastAttribute = node.attributes[node.attributes.length - 1];
  return sourceCode.getTokenAfter(
    lastAttribute,
    (token) => token.value === "}"
  );
}
