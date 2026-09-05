import { RuleTester } from "eslint";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import rule from "../../lint-configs/eslint-rules/plugin-imports.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
});

const tmp = mkdtempSync(path.join(tmpdir(), "plugin-imports-"));

function writePlugin(dir, { name, eslintConfig = false } = {}) {
  mkdirSync(dir, { recursive: true });
  if (name !== undefined) {
    writeFileSync(
      path.join(dir, "plugin.rb"),
      `# frozen_string_literal: true\n\n# name: ${name}\n# about: x\n`
    );
  }
  if (eslintConfig) {
    writeFileSync(path.join(dir, "eslint.config.mjs"), "export default [];\n");
  }
}

// The current plugin's name comes from `plugin.rb`'s `# name:`, which here
// ("chat") deliberately differs from the directory name ("chat-checkout").
const chatDir = path.join(tmp, "chat-checkout");
writePlugin(chatDir, { name: "chat", eslintConfig: true });
mkdirSync(path.join(chatDir, "assets/javascripts"), { recursive: true });
const chatFile = path.join(chatDir, "assets/javascripts/foo.js");

// A nested ESLint config with no adjacent `plugin.rb` must halt the upward
// search before it reaches the `plugin.rb` above it ("outer-plugin").
const outerDir = path.join(tmp, "outer");
writePlugin(outerDir, { name: "outer-plugin" });
mkdirSync(path.join(outerDir, "inner/sub"), { recursive: true });
writeFileSync(
  path.join(outerDir, "inner/eslint.config.mjs"),
  "export default [];\n"
);
const boundaryFile = path.join(outerDir, "inner/sub/foo.js");

ruleTester.run("plugin-imports", rule, {
  valid: [
    // Importing the current plugin's own modules — no attribute. (`chat` is
    // resolved from plugin.rb even though the directory is `chat-checkout`.)
    {
      code: `import X from "discourse/plugins/chat/lib/x";`,
      filename: chatFile,
    },
    {
      code: `import X from "discourse/plugins/chat/discourse/components/foo";`,
      filename: chatFile,
    },
    // Cross-plugin imports with an explicit attribute.
    {
      code: `import X from "discourse/plugins/other/lib/x" with { discoursePlugin: "optional" };`,
      filename: chatFile,
    },
    {
      code: `import X from "discourse/plugins/other/lib/x" with { discoursePlugin: "required" };`,
      filename: chatFile,
    },
    // Quoted attribute key is accepted too.
    {
      code: `import X from "discourse/plugins/other/lib/x" with { "discoursePlugin": "required" };`,
      filename: chatFile,
    },
    // Unrelated imports are ignored.
    { code: `import X from "discourse/lib/x";`, filename: chatFile },
    { code: `import X from "./sibling";`, filename: chatFile },
  ],
  invalid: [
    // Cross-plugin import without the attribute — added by the fixer.
    {
      code: `import Thing from "discourse/plugins/other/lib/thing";`,
      filename: chatFile,
      output: `import Thing from "discourse/plugins/other/lib/thing" with { discoursePlugin: "optional" };`,
      errors: [{ messageId: "missingAttribute" }],
    },
    // Cross-plugin import with an invalid value.
    {
      code: `import Thing from "discourse/plugins/other/lib/thing" with { discoursePlugin: "maybe" };`,
      filename: chatFile,
      errors: [{ messageId: "invalidValue" }],
    },
    // Current-plugin import that wrongly carries the attribute — removed by the fixer.
    {
      code: `import Thing from "discourse/plugins/chat/lib/thing" with { discoursePlugin: "optional" };`,
      filename: chatFile,
      output: `import Thing from "discourse/plugins/chat/lib/thing";`,
      errors: [{ messageId: "unexpectedAttribute" }],
    },
    // Same, with a quoted attribute key.
    {
      code: `import Thing from "discourse/plugins/chat/lib/thing" with { "discoursePlugin": "required" };`,
      filename: chatFile,
      output: `import Thing from "discourse/plugins/chat/lib/thing";`,
      errors: [{ messageId: "unexpectedAttribute" }],
    },
    // The search stops at `inner/eslint.config.mjs`, so `outer-plugin` is NOT
    // the current plugin — its import is treated as cross-plugin and requires
    // the attribute.
    {
      code: `import Thing from "discourse/plugins/outer-plugin/lib/thing";`,
      filename: boundaryFile,
      output: `import Thing from "discourse/plugins/outer-plugin/lib/thing" with { discoursePlugin: "optional" };`,
      errors: [{ messageId: "missingAttribute" }],
    },
  ],
});
