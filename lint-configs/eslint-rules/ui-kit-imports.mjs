/**
 * Converts a kebab-case string to PascalCase.
 * @param {string} str - e.g. "d-async-content"
 * @returns {string} - e.g. "DAsyncContent"
 */
function kebabToPascal(str) {
  return str
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Converts a kebab-case string to camelCase.
 * @param {string} str - e.g. "d-age-with-tooltip"
 * @returns {string} - e.g. "dAgeWithTooltip"
 */
function kebabToCamel(str) {
  return str
    .split("-")
    .map((part, i) =>
      i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");
}

/**
 * Returns true if the old import path is for a component (not a helper or modifier).
 * @param {string} oldPath
 * @returns {boolean}
 */
function isComponentPath(oldPath) {
  return !oldPath.includes("/helpers/") && !oldPath.includes("/modifiers/");
}

/**
 * Computes the canonical identifier name for a given new import path.
 * Components use PascalCase, helpers/modifiers use camelCase.
 * @param {string} oldPath - The old import path (to determine component vs helper/modifier)
 * @param {string} newPath - The new import path
 * @returns {string}
 */
function canonicalName(oldPath, newPath) {
  const basename = newPath.split("/").pop();
  return isComponentPath(oldPath)
    ? kebabToPascal(basename)
    : kebabToCamel(basename);
}

const USE_UI_KIT = "Use `{{newSource}}` instead of `{{oldSource}}`";

const messages = {
  pathOnly: `${USE_UI_KIT}.`,
  rename: `${USE_UI_KIT}. Rename \`{{localName}}\` to \`{{newName}}\`.`,
  conflict: `${USE_UI_KIT}: \`{{newName}}\` conflicts with an existing identifier. Rename manually.`,
};

export default {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "migrate imports to discourse/ui-kit/ paths and rename identifiers to match the d- prefix convention",
    },
    fixable: "code",
    messages,
    schema: [],
  },

  create(context) {
    // Collect all pending reports so we can emit a single combined fix in
    // Program:exit. This avoids overlapping composite-fix ranges when
    // multiple imports are fixed in the same file (ESLint merges all fix
    // operations from a single report into one range, and when that range
    // spans from an import to a closing tag deep in the template, it blocks
    // other imports' fixes from being applied in the same pass).
    const pendingReports = [];

    return {
      ImportDeclaration(node) {
        const oldSource = node.source.value;
        const newSource = MAPPINGS[oldSource];

        if (!newSource) {
          return;
        }

        const defaultSpecifier = node.specifiers.find(
          (s) => s.type === "ImportDefaultSpecifier"
        );

        // No default import (namespace or named-only) — just fix the path
        if (!defaultSpecifier) {
          pendingReports.push({
            node,
            messageId: "pathOnly",
            data: { oldSource, newSource },
            fixable: true,
            kind: "pathOnly",
          });
          return;
        }

        const localName = defaultSpecifier.local.name;
        const newName = canonicalName(oldSource, newSource);

        // Local name already matches canonical new name — just fix the path
        if (localName === newName) {
          pendingReports.push({
            node,
            messageId: "pathOnly",
            data: { oldSource, newSource },
            fixable: true,
            kind: "pathOnly",
          });
          return;
        }

        // Rename needed — check for naming conflicts
        const moduleScope = context.sourceCode.scopeManager.scopes.find(
          (s) => s.type === "module"
        );

        const hasConflict = moduleScope?.variables.some(
          (v) => v.name === newName && v.defs[0]?.node !== defaultSpecifier
        );

        if (hasConflict) {
          pendingReports.push({
            node,
            messageId: "conflict",
            data: { oldSource, newSource, localName, newName },
            fixable: false,
            kind: "conflict",
          });
          return;
        }

        const variable = moduleScope?.variables.find(
          (v) => v.name === localName
        );

        pendingReports.push({
          node,
          messageId: "rename",
          data: { oldSource, newSource, localName, newName },
          fixable: true,
          kind: "rename",
          defaultSpecifier,
          variable,
        });
      },

      ExportNamedDeclaration(node) {
        if (!node.source) {
          return;
        }

        const oldSource = node.source.value;
        const newSource = MAPPINGS[oldSource];

        if (!newSource) {
          return;
        }

        pendingReports.push({
          node,
          messageId: "pathOnly",
          data: { oldSource, newSource },
          fixable: true,
          kind: "pathOnly",
        });
      },

      // Handle importSync("discourse/components/...") calls, but only when
      // importSync is imported from "@embroider/macros".
      "CallExpression[callee.name='importSync']"(node) {
        const arg = node.arguments[0];
        if (!arg || arg.type !== "Literal" || typeof arg.value !== "string") {
          return;
        }

        const oldSource = arg.value;
        const newSource = MAPPINGS[oldSource];

        if (!newSource) {
          return;
        }

        // Verify importSync comes from @embroider/macros
        const moduleScope = context.sourceCode.scopeManager.scopes.find(
          (s) => s.type === "module"
        );
        const importSyncVar = moduleScope?.variables.find(
          (v) => v.name === "importSync"
        );
        const importDef = importSyncVar?.defs.find(
          (d) =>
            d.type === "ImportBinding" &&
            d.parent?.source?.value === "@embroider/macros"
        );
        if (!importDef) {
          return;
        }

        pendingReports.push({
          node,
          messageId: "pathOnly",
          data: { oldSource, newSource },
          fixable: true,
          kind: "importSync",
          importSyncArg: arg,
        });
      },

      "Program:exit"() {
        // Scan JSDoc comments for import("discourse/...") type references.
        // These aren't AST nodes, so we use regex over comment text.
        const JSDOC_IMPORT_RE = /import\(["']([^"']+)["']\)/g;
        const EXTENSION_RE = /\.(gjs|js|ts|gts)$/;

        for (const comment of context.sourceCode.getAllComments()) {
          let match;
          while ((match = JSDOC_IMPORT_RE.exec(comment.value)) !== null) {
            const rawPath = match[1];
            const stripped = rawPath.replace(EXTENSION_RE, "");
            const newSource = MAPPINGS[stripped];

            if (!newSource) {
              continue;
            }

            const ext = rawPath.match(EXTENSION_RE)?.[0] || "";
            const fullNewSource = newSource + ext;

            // Compute the range of the path string inside the comment.
            // comment.range[0] points to /* or //, add 2 to skip the
            // opening delimiter, then match.index is relative to comment.value.
            const pathStart =
              comment.range[0] + 2 + match.index + match[0].indexOf(rawPath);
            const pathEnd = pathStart + rawPath.length;

            pendingReports.push({
              node: context.sourceCode.ast,
              messageId: "pathOnly",
              data: { oldSource: rawPath, newSource: fullNewSource },
              fixable: true,
              kind: "jsdoc",
              jsdocRange: [pathStart, pathEnd],
              jsdocNewSource: fullNewSource,
            });
          }
        }

        if (pendingReports.length === 0) {
          return;
        }

        const sourceText = context.sourceCode.getText();
        const fixableReports = pendingReports.filter((r) => r.fixable);

        // Emit all reports. Attach a single combined fix to the first
        // fixable report — this avoids overlapping composite ranges.
        let fixAttached = false;

        for (const report of pendingReports) {
          const reportObj = {
            node: report.node,
            messageId: report.messageId,
            data: report.data,
          };

          if (report.fixable && !fixAttached) {
            fixAttached = true;
            reportObj.fix = (fixer) =>
              buildCombinedFix(fixer, fixableReports, sourceText);
          }

          context.report(reportObj);
        }
      },
    };
  },
};

/**
 * Builds a single array of fix operations covering ALL fixable imports.
 * Having one combined fix avoids overlapping composite ranges.
 */
function buildCombinedFix(fixer, reports, sourceText) {
  const fixes = [];
  const fixedRanges = new Set();

  function addFix(fix) {
    const range = fix.range;
    const key = `${range[0]}:${range[1]}`;
    if (!fixedRanges.has(key)) {
      fixedRanges.add(key);
      fixes.push(fix);
    }
  }

  for (const report of reports) {
    if (report.kind === "jsdoc") {
      addFix(fixer.replaceTextRange(report.jsdocRange, report.jsdocNewSource));
      continue;
    }

    if (report.kind === "importSync") {
      addFix(
        fixer.replaceText(report.importSyncArg, `"${report.data.newSource}"`)
      );
      continue;
    }

    if (report.kind === "pathOnly") {
      addFix(
        fixer.replaceText(report.node.source, `"${report.data.newSource}"`)
      );
      continue;
    }

    // kind === "rename"
    const { node, defaultSpecifier, variable, data } = report;
    const { newSource, localName, newName } = data;

    addFix(fixer.replaceText(node.source, `"${newSource}"`));
    addFix(fixer.replaceText(defaultSpecifier, newName));

    if (variable) {
      for (const ref of variable.references) {
        if (ref.identifier !== defaultSpecifier.local) {
          addFix(fixer.replaceText(ref.identifier, newName));

          // For component elements with closing tags (e.g. <NavItem>...</NavItem>),
          // variable.references only covers the opening tag. We must also
          // fix the closing tag to avoid a Glimmer parse error.
          // Walk up the parent chain to find the GlimmerElementNode — it may
          // be the direct parent (GlimmerElementNodePart → GlimmerElementNode)
          // or deeper when inside {{#if}}/{{#each}} blocks.
          let elementNode = ref.identifier.parent;
          while (elementNode && elementNode.type !== "GlimmerElementNode") {
            elementNode = elementNode.parent;
          }
          if (elementNode && !elementNode.selfClosing) {
            const closingTag = `</${localName}>`;
            const searchStart = elementNode.range[0];
            const searchEnd = elementNode.range[1];
            const idx = sourceText.lastIndexOf(closingTag, searchEnd - 1);
            if (idx >= searchStart) {
              const nameStart = idx + 2; // skip "</"
              const nameEnd = nameStart + localName.length;
              addFix(fixer.replaceTextRange([nameStart, nameEnd], newName));
            }
          }
        }
      }
    }
  }

  return fixes;
}

// Mapping from old import paths to new ui-kit paths.
// Extracted from discourse/discourse PR #38703 (ui-kit-shims.js).
const MAPPINGS = {
  // Components — already d-prefixed (path change only)
  "discourse/components/d-autocomplete-results":
    "discourse/ui-kit/d-autocomplete-results",
  "discourse/components/d-breadcrumbs-container":
    "discourse/ui-kit/d-breadcrumbs-container",
  "discourse/components/d-breadcrumbs-item":
    "discourse/ui-kit/d-breadcrumbs-item",
  "discourse/components/d-button": "discourse/ui-kit/d-button",
  "discourse/components/d-combo-button": "discourse/ui-kit/d-combo-button",
  "discourse/components/d-editor": "discourse/ui-kit/d-editor",
  "discourse/components/d-modal": "discourse/ui-kit/d-modal",
  "discourse/components/d-modal-cancel": "discourse/ui-kit/d-modal-cancel",
  "discourse/components/d-multi-select": "discourse/ui-kit/d-multi-select",
  "discourse/components/d-navigation-item":
    "discourse/ui-kit/d-navigation-item",
  "discourse/components/d-otp": "discourse/ui-kit/d-otp",
  "discourse/components/d-page-action-button":
    "discourse/ui-kit/d-page-action-button",
  "discourse/components/d-page-header": "discourse/ui-kit/d-page-header",
  "discourse/components/d-page-subheader": "discourse/ui-kit/d-page-subheader",
  "discourse/components/d-select": "discourse/ui-kit/d-select",
  "discourse/components/d-stat-tiles": "discourse/ui-kit/d-stat-tiles",
  "discourse/components/d-textarea": "discourse/ui-kit/d-textarea",
  "discourse/components/d-toggle-switch": "discourse/ui-kit/d-toggle-switch",

  // Components — renamed (old unprefixed → new d-prefixed)
  "discourse/components/async-content": "discourse/ui-kit/d-async-content",
  "discourse/components/avatar-flair": "discourse/ui-kit/d-avatar-flair",
  "discourse/components/badge-button": "discourse/ui-kit/d-badge-button",
  "discourse/components/badge-card": "discourse/ui-kit/d-badge-card",
  "discourse/components/calendar-date-time-input":
    "discourse/ui-kit/d-calendar-date-time-input",
  "discourse/components/cdn-img": "discourse/ui-kit/d-cdn-img",
  "discourse/components/char-counter": "discourse/ui-kit/d-char-counter",
  "discourse/components/color-picker": "discourse/ui-kit/d-color-picker",
  "discourse/components/color-picker-choice":
    "discourse/ui-kit/d-color-picker-choice",
  "discourse/components/conditional-in-element":
    "discourse/ui-kit/d-conditional-in-element",
  "discourse/components/conditional-loading-section":
    "discourse/ui-kit/d-conditional-loading-section",
  "discourse/components/conditional-loading-spinner":
    "discourse/ui-kit/d-conditional-loading-spinner",
  "discourse/components/cook-text": "discourse/ui-kit/d-cook-text",
  "discourse/components/copy-button": "discourse/ui-kit/d-copy-button",
  "discourse/components/count-i18n": "discourse/ui-kit/d-count-i18n",
  "discourse/components/custom-html": "discourse/ui-kit/d-custom-html",
  "discourse/components/date-input": "discourse/ui-kit/d-date-input",
  "discourse/components/date-picker": "discourse/ui-kit/d-date-picker",
  "discourse/components/date-time-input": "discourse/ui-kit/d-date-time-input",
  "discourse/components/date-time-input-range":
    "discourse/ui-kit/d-date-time-input-range",
  "discourse/components/decorated-html": "discourse/ui-kit/d-decorated-html",
  "discourse/components/dropdown-menu": "discourse/ui-kit/d-dropdown-menu",
  "discourse/components/empty-state": "discourse/ui-kit/d-empty-state",
  "discourse/components/expanding-text-area":
    "discourse/ui-kit/d-expanding-text-area",
  "discourse/components/filter-input": "discourse/ui-kit/d-filter-input",
  "discourse/components/flash-message": "discourse/ui-kit/d-flash-message",
  "discourse/components/future-date-input":
    "discourse/ui-kit/d-future-date-input",
  "discourse/components/highlighted-code":
    "discourse/ui-kit/d-highlighted-code",
  "discourse/components/horizontal-overflow-nav":
    "discourse/ui-kit/d-horizontal-overflow-nav",
  "discourse/components/html-with-links": "discourse/ui-kit/d-html-with-links",
  "discourse/components/input-tip": "discourse/ui-kit/d-input-tip",
  "discourse/components/interpolated-translation":
    "discourse/ui-kit/d-interpolated-translation",
  "discourse/components/light-dark-img": "discourse/ui-kit/d-light-dark-img",
  "discourse/components/load-more": "discourse/ui-kit/d-load-more",
  "discourse/components/nav-item": "discourse/ui-kit/d-nav-item",
  "discourse/components/number-field": "discourse/ui-kit/d-number-field",
  "discourse/components/password-field": "discourse/ui-kit/d-password-field",
  "discourse/components/pick-files-button":
    "discourse/ui-kit/d-pick-files-button",
  "discourse/components/popup-input-tip": "discourse/ui-kit/d-popup-input-tip",
  "discourse/components/radio-button": "discourse/ui-kit/d-radio-button",
  "discourse/components/relative-date": "discourse/ui-kit/d-relative-date",
  "discourse/components/relative-time-picker":
    "discourse/ui-kit/d-relative-time-picker",
  "discourse/components/responsive-table":
    "discourse/ui-kit/d-responsive-table",
  "discourse/components/save-controls": "discourse/ui-kit/d-save-controls",
  "discourse/components/second-factor-input":
    "discourse/ui-kit/d-second-factor-input",
  "discourse/components/small-user-list": "discourse/ui-kit/d-small-user-list",
  "discourse/components/table-header-toggle":
    "discourse/ui-kit/d-table-header-toggle",
  "discourse/components/tap-tile": "discourse/ui-kit/d-tap-tile",
  "discourse/components/tap-tile-grid": "discourse/ui-kit/d-tap-tile-grid",
  "discourse/components/text-field": "discourse/ui-kit/d-text-field",
  "discourse/components/textarea": "discourse/ui-kit/d-textarea",
  "discourse/components/time-input": "discourse/ui-kit/d-time-input",
  "discourse/components/time-shortcut-picker":
    "discourse/ui-kit/d-time-shortcut-picker",
  "discourse/components/toggle-password-mask":
    "discourse/ui-kit/d-toggle-password-mask",
  "discourse/components/user-avatar": "discourse/ui-kit/d-user-avatar",
  "discourse/components/user-avatar-flair":
    "discourse/ui-kit/d-user-avatar-flair",
  "discourse/components/user-info": "discourse/ui-kit/d-user-info",
  "discourse/components/user-link": "discourse/ui-kit/d-user-link",
  "discourse/components/user-stat": "discourse/ui-kit/d-user-stat",
  "discourse/components/user-status-message":
    "discourse/ui-kit/d-user-status-message",

  // Helpers — already d-prefixed
  "discourse/helpers/d-icon": "discourse/ui-kit/helpers/d-icon",

  // Helpers — renamed
  "discourse/helpers/age-with-tooltip":
    "discourse/ui-kit/helpers/d-age-with-tooltip",
  "discourse/helpers/avatar": "discourse/ui-kit/helpers/d-avatar",
  "discourse/helpers/base-path": "discourse/ui-kit/helpers/d-base-path",
  "discourse/helpers/bound-avatar": "discourse/ui-kit/helpers/d-bound-avatar",
  "discourse/helpers/bound-avatar-template":
    "discourse/ui-kit/helpers/d-bound-avatar-template",
  "discourse/helpers/bound-category-link":
    "discourse/ui-kit/helpers/d-bound-category-link",
  "discourse/helpers/category-badge":
    "discourse/ui-kit/helpers/d-category-badge",
  "discourse/helpers/category-link": "discourse/ui-kit/helpers/d-category-link",
  "discourse/helpers/concat-class": "discourse/ui-kit/helpers/d-concat-class",
  "discourse/helpers/dasherize": "discourse/ui-kit/helpers/d-dasherize",
  "discourse/helpers/dir-span": "discourse/ui-kit/helpers/d-dir-span",
  "discourse/helpers/discourse-tag": "discourse/ui-kit/helpers/d-discourse-tag",
  "discourse/helpers/discourse-tags":
    "discourse/ui-kit/helpers/d-discourse-tags",
  "discourse/helpers/element": "discourse/ui-kit/helpers/d-element",
  "discourse/helpers/emoji": "discourse/ui-kit/helpers/d-emoji",
  "discourse/helpers/format-date": "discourse/ui-kit/helpers/d-format-date",
  "discourse/helpers/format-duration":
    "discourse/ui-kit/helpers/d-format-duration",
  "discourse/helpers/icon-or-image": "discourse/ui-kit/helpers/d-icon-or-image",
  "discourse/helpers/loading-spinner":
    "discourse/ui-kit/helpers/d-loading-spinner",
  "discourse/helpers/number": "discourse/ui-kit/helpers/d-number",
  "discourse/helpers/replace-emoji": "discourse/ui-kit/helpers/d-replace-emoji",
  "discourse/helpers/topic-link": "discourse/ui-kit/helpers/d-topic-link",
  "discourse/helpers/unique-id": "discourse/ui-kit/helpers/d-unique-id",
  "discourse/helpers/user-avatar": "discourse/ui-kit/helpers/d-user-avatar",

  // Modifiers — already d-prefixed
  "discourse/modifiers/d-autocomplete":
    "discourse/ui-kit/modifiers/d-autocomplete",

  // Modifiers — renamed
  "discourse/modifiers/auto-focus": "discourse/ui-kit/modifiers/d-auto-focus",
  "discourse/modifiers/close-on-click-outside":
    "discourse/ui-kit/modifiers/d-close-on-click-outside",
  "discourse/modifiers/draggable": "discourse/ui-kit/modifiers/d-draggable",
  "discourse/modifiers/observe-intersection":
    "discourse/ui-kit/modifiers/d-observe-intersection",
  "discourse/modifiers/on-resize": "discourse/ui-kit/modifiers/d-on-resize",
  "discourse/modifiers/scroll-into-view":
    "discourse/ui-kit/modifiers/d-scroll-into-view",
  "discourse/modifiers/swipe": "discourse/ui-kit/modifiers/d-swipe",
  "discourse/modifiers/tab-to-sibling":
    "discourse/ui-kit/modifiers/d-tab-to-sibling",
  "discourse/modifiers/trap-tab": "discourse/ui-kit/modifiers/d-trap-tab",
};
