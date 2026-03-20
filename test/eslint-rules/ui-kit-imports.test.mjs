import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import { describe, it } from "mocha";
import rule from "../../lint-configs/eslint-rules/ui-kit-imports.mjs";

const ruleTester = new RuleTester();
const gjsRuleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

describe("ui-kit-imports", function () {
  it("validates ui-kit import migrations", function () {
    ruleTester.run("ui-kit-imports", rule, {
      valid: [
        // Already migrated
        { code: `import DButton from "discourse/ui-kit/d-button";` },
        { code: `import dIcon from "discourse/ui-kit/helpers/d-icon";` },
        {
          code: `import dAutoFocus from "discourse/ui-kit/modifiers/d-auto-focus";`,
        },
        // Unrelated imports
        { code: `import Component from "@glimmer/component";` },
        { code: `import { service } from "@ember/service";` },
        // importSync not from @embroider/macros — should not trigger
        {
          code: `function importSync(x) { return x; }\nimportSync("discourse/helpers/d-icon")`,
        },
        // JSDoc import with already-migrated path
        {
          code: `/** @type {import("discourse/ui-kit/helpers/d-element").default} */\nconst x = 1;`,
        },
        // Already migrated re-exports
        {
          code: `export { foo } from "discourse/ui-kit/helpers/d-category-link";`,
        },
      ],

      invalid: [
        // Path only — local name already matches canonical new name
        {
          code: `import DButton from "discourse/components/d-button";`,
          output: `import DButton from "discourse/ui-kit/d-button";`,
          errors: [{ messageId: "pathOnly" }],
        },
        {
          code: `import DAsyncContent from "discourse/components/async-content";`,
          output: `import DAsyncContent from "discourse/ui-kit/d-async-content";`,
          errors: [{ messageId: "pathOnly" }],
        },
        {
          code: `import dIcon from "discourse/helpers/d-icon";`,
          output: `import dIcon from "discourse/ui-kit/helpers/d-icon";`,
          errors: [{ messageId: "pathOnly" }],
        },
        {
          code: `import dAutoFocus from "discourse/modifiers/auto-focus";`,
          output: `import dAutoFocus from "discourse/ui-kit/modifiers/d-auto-focus";`,
          errors: [{ messageId: "pathOnly" }],
        },

        // Path + rename — component (PascalCase)
        {
          code: `import AsyncContent from "discourse/components/async-content";\nAsyncContent;`,
          output: `import DAsyncContent from "discourse/ui-kit/d-async-content";\nDAsyncContent;`,
          errors: [{ messageId: "rename" }],
        },
        {
          code: `import AvatarFlair from "discourse/components/avatar-flair";\nAvatarFlair;`,
          output: `import DAvatarFlair from "discourse/ui-kit/d-avatar-flair";\nDAvatarFlair;`,
          errors: [{ messageId: "rename" }],
        },

        // Path + rename — helper (camelCase)
        {
          code: `import icon from "discourse/helpers/d-icon";\nicon;`,
          output: `import dIcon from "discourse/ui-kit/helpers/d-icon";\ndIcon;`,
          errors: [{ messageId: "rename" }],
        },
        {
          code: `import avatar from "discourse/helpers/avatar";\navatar;`,
          output: `import dAvatar from "discourse/ui-kit/helpers/d-avatar";\ndAvatar;`,
          errors: [{ messageId: "rename" }],
        },
        {
          code: `import concatClass from "discourse/helpers/concat-class";\nconcatClass;`,
          output: `import dConcatClass from "discourse/ui-kit/helpers/d-concat-class";\ndConcatClass;`,
          errors: [{ messageId: "rename" }],
        },

        // Path + rename — modifier (camelCase)
        {
          code: `import autoFocus from "discourse/modifiers/auto-focus";\nautoFocus;`,
          output: `import dAutoFocus from "discourse/ui-kit/modifiers/d-auto-focus";\ndAutoFocus;`,
          errors: [{ messageId: "rename" }],
        },

        // Rename renames all references
        {
          code: [
            `import EmptyState from "discourse/components/empty-state";`,
            `const x = EmptyState;`,
            `console.log(EmptyState);`,
          ].join("\n"),
          output: [
            `import DEmptyState from "discourse/ui-kit/d-empty-state";`,
            `const x = DEmptyState;`,
            `console.log(DEmptyState);`,
          ].join("\n"),
          errors: [{ messageId: "rename" }],
        },

        // Naming conflict — no autofix
        {
          code: [
            `import AsyncContent from "discourse/components/async-content";`,
            `const DAsyncContent = "conflict";`,
          ].join("\n"),
          output: null,
          errors: [{ messageId: "conflict" }],
        },

        // The "textarea" → "d-textarea" mapping (component path, not to be
        // confused with the already-prefixed "d-textarea" entry)
        {
          code: `import Textarea from "discourse/components/textarea";`,
          output: `import DTextarea from "discourse/ui-kit/d-textarea";`,
          errors: [{ messageId: "rename" }],
        },

        // Re-exports — path only
        {
          code: `export { categoryLinkHTML as default } from "discourse/helpers/category-link";`,
          output: `export { categoryLinkHTML as default } from "discourse/ui-kit/helpers/d-category-link";`,
          errors: [{ messageId: "pathOnly" }],
        },
        {
          code: `export { default } from "discourse/components/load-more";`,
          output: `export { default } from "discourse/ui-kit/d-load-more";`,
          errors: [{ messageId: "pathOnly" }],
        },

        // JSDoc import() types
        {
          code: `/** @type {import("discourse/helpers/element").default} */\nconst x = 1;`,
          output: `/** @type {import("discourse/ui-kit/helpers/d-element").default} */\nconst x = 1;`,
          errors: [{ messageId: "pathOnly" }],
        },
        {
          code: `/** @type {import("discourse/helpers/element.gjs").default} */\nconst x = 1;`,
          output: `/** @type {import("discourse/ui-kit/helpers/d-element.gjs").default} */\nconst x = 1;`,
          errors: [{ messageId: "pathOnly" }],
        },
        {
          code: `/** @type {import("discourse/components/async-content.gjs").default} */\nconst x = 1;`,
          output: `/** @type {import("discourse/ui-kit/d-async-content.gjs").default} */\nconst x = 1;`,
          errors: [{ messageId: "pathOnly" }],
        },
        {
          code: `/** @type {import("discourse/components/d-button.js").default} */\nconst x = 1;`,
          output: `/** @type {import("discourse/ui-kit/d-button.js").default} */\nconst x = 1;`,
          errors: [{ messageId: "pathOnly" }],
        },

        // importSync() calls from @embroider/macros
        {
          code: `import { importSync } from "@embroider/macros";\nimportSync("discourse/helpers/d-icon")`,
          output: `import { importSync } from "@embroider/macros";\nimportSync("discourse/ui-kit/helpers/d-icon")`,
          errors: [{ messageId: "pathOnly" }],
        },
        {
          code: `import { importSync } from "@embroider/macros";\nimportSync("discourse/helpers/category-link")`,
          output: `import { importSync } from "@embroider/macros";\nimportSync("discourse/ui-kit/helpers/d-category-link")`,
          errors: [{ messageId: "pathOnly" }],
        },
        {
          code: `import { importSync } from "@embroider/macros";\nimportSync("discourse/components/conditional-loading-spinner")`,
          output: `import { importSync } from "@embroider/macros";\nimportSync("discourse/ui-kit/d-conditional-loading-spinner")`,
          errors: [{ messageId: "pathOnly" }],
        },
      ],
    });
  });

  it("renames usages inside template tags", function () {
    gjsRuleTester.run("ui-kit-imports (gjs)", rule, {
      valid: [
        {
          code: `
            import DButton from "discourse/ui-kit/d-button";
            <template><DButton /></template>
          `,
        },
      ],

      invalid: [
        // Component rename propagates into self-closing template tag
        {
          code: `
            import AsyncContent from "discourse/components/async-content";
            <template><AsyncContent /></template>
          `,
          output: `
            import DAsyncContent from "discourse/ui-kit/d-async-content";
            <template><DAsyncContent /></template>
          `,
          errors: [{ messageId: "rename" }],
        },

        // Component rename propagates into block (non-self-closing) template tag
        {
          code: `
            import NavItem from "discourse/components/nav-item";
            <template><NavItem>content</NavItem></template>
          `,
          output: `
            import DNavItem from "discourse/ui-kit/d-nav-item";
            <template><DNavItem>content</DNavItem></template>
          `,
          errors: [{ messageId: "rename" }],
        },

        // Helper rename propagates into template
        {
          code: `
            import concatClass from "discourse/helpers/concat-class";
            <template>{{concatClass "a" "b"}}</template>
          `,
          output: `
            import dConcatClass from "discourse/ui-kit/helpers/d-concat-class";
            <template>{{dConcatClass "a" "b"}}</template>
          `,
          errors: [{ messageId: "rename" }],
        },

        // Modifier rename propagates into template
        {
          code: `
            import autoFocus from "discourse/modifiers/auto-focus";
            <template><input {{autoFocus}} /></template>
          `,
          output: `
            import dAutoFocus from "discourse/ui-kit/modifiers/d-auto-focus";
            <template><input {{dAutoFocus}} /></template>
          `,
          errors: [{ messageId: "rename" }],
        },

        // Path-only when name already matches (no rename in template)
        {
          code: `
            import DButton from "discourse/components/d-button";
            <template><DButton /></template>
          `,
          output: `
            import DButton from "discourse/ui-kit/d-button";
            <template><DButton /></template>
          `,
          errors: [{ messageId: "pathOnly" }],
        },

        // Component rename with nested elements
        {
          code: `
            import EmptyState from "discourse/components/empty-state";
            <template>
              <div>
                <EmptyState>
                  <span>nested content</span>
                </EmptyState>
              </div>
            </template>
          `,
          output: `
            import DEmptyState from "discourse/ui-kit/d-empty-state";
            <template>
              <div>
                <DEmptyState>
                  <span>nested content</span>
                </DEmptyState>
              </div>
            </template>
          `,
          errors: [{ messageId: "rename" }],
        },

        // Multiple usages of same component (self-closing + block)
        {
          code: `
            import NavItem from "discourse/components/nav-item";
            <template>
              <NavItem />
              <NavItem>block</NavItem>
            </template>
          `,
          output: `
            import DNavItem from "discourse/ui-kit/d-nav-item";
            <template>
              <DNavItem />
              <DNavItem>block</DNavItem>
            </template>
          `,
          errors: [{ messageId: "rename" }],
        },

        // Complex: mixed component rename, helper, and modifier in one template
        {
          code: `
            import EmptyState from "discourse/components/empty-state";
            import concatClass from "discourse/helpers/concat-class";
            import autoFocus from "discourse/modifiers/auto-focus";
            <template>
              <EmptyState>
                <input {{autoFocus}} class={{concatClass "a" "b"}} />
              </EmptyState>
            </template>
          `,
          output: `
            import DEmptyState from "discourse/ui-kit/d-empty-state";
            import dConcatClass from "discourse/ui-kit/helpers/d-concat-class";
            import dAutoFocus from "discourse/ui-kit/modifiers/d-auto-focus";
            <template>
              <DEmptyState>
                <input {{dAutoFocus}} class={{dConcatClass "a" "b"}} />
              </DEmptyState>
            </template>
          `,
          errors: [
            { messageId: "rename" },
            { messageId: "rename" },
            { messageId: "rename" },
          ],
        },

        // Complex: nested renamed components
        {
          code: `
            import EmptyState from "discourse/components/empty-state";
            import NavItem from "discourse/components/nav-item";
            <template>
              <EmptyState>
                <NavItem>link</NavItem>
              </EmptyState>
            </template>
          `,
          output: `
            import DEmptyState from "discourse/ui-kit/d-empty-state";
            import DNavItem from "discourse/ui-kit/d-nav-item";
            <template>
              <DEmptyState>
                <DNavItem>link</DNavItem>
              </DEmptyState>
            </template>
          `,
          errors: [{ messageId: "rename" }, { messageId: "rename" }],
        },

        // Complex: renamed component with path-only component nested inside
        {
          code: `
            import NavItem from "discourse/components/nav-item";
            import DButton from "discourse/components/d-button";
            <template>
              <NavItem>
                <DButton />
              </NavItem>
            </template>
          `,
          output: `
            import DNavItem from "discourse/ui-kit/d-nav-item";
            import DButton from "discourse/ui-kit/d-button";
            <template>
              <DNavItem>
                <DButton />
              </DNavItem>
            </template>
          `,
          errors: [{ messageId: "rename" }, { messageId: "pathOnly" }],
        },

        // Complex: renamed component + modifier on same element, helper inside
        // another renamed component
        {
          code: `
            import NavItem from "discourse/components/nav-item";
            import EmptyState from "discourse/components/empty-state";
            import autoFocus from "discourse/modifiers/auto-focus";
            import concatClass from "discourse/helpers/concat-class";
            <template>
              <EmptyState>
                <NavItem {{autoFocus}} class={{concatClass "a" "b"}}>
                  content
                </NavItem>
              </EmptyState>
            </template>
          `,
          output: `
            import DNavItem from "discourse/ui-kit/d-nav-item";
            import DEmptyState from "discourse/ui-kit/d-empty-state";
            import dAutoFocus from "discourse/ui-kit/modifiers/d-auto-focus";
            import dConcatClass from "discourse/ui-kit/helpers/d-concat-class";
            <template>
              <DEmptyState>
                <DNavItem {{dAutoFocus}} class={{dConcatClass "a" "b"}}>
                  content
                </DNavItem>
              </DEmptyState>
            </template>
          `,
          errors: [
            { messageId: "rename" },
            { messageId: "rename" },
            { messageId: "rename" },
            { messageId: "rename" },
          ],
        },

        // Block component with attributes, {{#each}} blocks, and self-closing reuse
        // (real-world pattern from categories-modal.gjs)
        {
          code: `
            import ConditionalLoadingSpinner from "discourse/components/conditional-loading-spinner";
            <template>
              <ConditionalLoadingSpinner @condition={{this.loading}}>
                {{#each this.items as |item|}}
                  <div>{{item}}</div>
                {{/each}}
              </ConditionalLoadingSpinner>
              <ConditionalLoadingSpinner @condition={{this.more}} />
            </template>
          `,
          output: `
            import DConditionalLoadingSpinner from "discourse/ui-kit/d-conditional-loading-spinner";
            <template>
              <DConditionalLoadingSpinner @condition={{this.loading}}>
                {{#each this.items as |item|}}
                  <div>{{item}}</div>
                {{/each}}
              </DConditionalLoadingSpinner>
              <DConditionalLoadingSpinner @condition={{this.more}} />
            </template>
          `,
          errors: [{ messageId: "rename" }],
        },

        // Naming conflict — no autofix even with template usage
        {
          code: [
            `import AsyncContent from "discourse/components/async-content";`,
            `const DAsyncContent = "conflict";`,
            `<template><AsyncContent /></template>`,
          ].join("\n"),
          output: null,
          errors: [{ messageId: "conflict" }],
        },
      ],
    });
  });
});
