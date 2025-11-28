import { execSync } from "node:child_process";
import console from "node:console";
import { readFileSync } from "node:fs";
import process, { chdir, stdout } from "node:process";

// TODO: use this after enabling `moved-packages-import-paths` rule
// const expectedEslintOutput = `
// /path-prefix/my-component.gjs
//   1:1  error  Use 'discourse/truth-helpers' instead of 'truth-helpers'  discourse/moved-packages-import-paths
//   1:1  error  Run autofix to sort these imports!                        simple-import-sort/imports
//
// ✖ 2 problems (2 errors, 0 warnings)
//   2 errors and 0 warnings potentially fixable with the \`--fix\` option.
// `;

const expectedEslintOutput = `
/path-prefix/my-component.gjs
  1:1  error  Run autofix to sort these imports!  simple-import-sort/imports

✖ 1 problem (1 error, 0 warnings)
  1 error and 0 warnings potentially fixable with the \`--fix\` option.
`;

const expectedStylelintOutput = `
style.scss
  14:1  ✖  Unexpected duplicate selector "::placeholder", first used at line 10    no-duplicate-selectors
  25:3  ✖  Replace "@include breakpoint(...)" with "@include viewport.until(...)"  discourse/no-breakpoint-mixin

✖ 2 problems (2 errors, 0 warnings)
  1 error potentially fixable with the "--fix" option.
`;

const expectedTemplateLintOutput = `
Linting 1 Total Files with TemplateLint
	.gjs: 1

my-component.gjs
  18:4  error  Unexpected {{log}} usage.  no-log

✖ 1 problems (1 errors, 0 warnings)
`;

function eslint() {
  stdout.write("eslint... ");

  let actual;
  try {
    actual = execSync(
      "pnpm eslint --concurrency 2 my-component.gjs"
    ).toString();
  } catch (e) {
    actual = e.stdout.toString();
    actual = actual.replace(/^\/.+\/test\/(cjs|cjs-theme)\//m, "/path-prefix/");
  }

  if (expectedEslintOutput.trim() === actual.trim()) {
    console.log("✅");
  } else {
    process.exitCode = 1;
    console.error(
      `failed\n\nexpected:\n${expectedEslintOutput}\nactual:\n${actual}`
    );
  }
}

function eslintAutofix() {
  stdout.write("eslint autofix... ");

  try {
    execSync("pnpm eslint my-component.gjs --fix-dry-run").toString();
    console.log("✅");
  } catch (e) {
    process.exitCode = 1;
    console.error(`failed\n${e.stdout}`);
    return;
  }
}

function prettier() {
  stdout.write("prettier... ");

  const expected = readFileSync("formatted-my-component.gjs", "utf8");
  let actual;

  try {
    actual = execSync(
      "cat my-component.gjs | pnpm prettier --stdin-filepath=my-component.gjs"
    ).toString();
  } catch (e) {
    actual = e.stdout.toString();
  }

  if (expected.trim() === actual.trim()) {
    console.log("✅");
  } else {
    process.exitCode = 1;
    console.error(`failed\n\nexpected:\n${expected}\nactual:\n${actual}`);
  }
}

function prettierScss() {
  stdout.write("prettier - SCSS... ");

  const expected = readFileSync("style.scss", "utf8");
  let actual;

  try {
    actual = execSync(
      "cat style.scss | pnpm prettier --stdin-filepath=style.scss"
    ).toString();
  } catch (e) {
    actual = e.stdout.toString();
  }

  if (expected.trim() === actual.trim()) {
    console.log("✅");
  } else {
    process.exitCode = 1;
    console.error(`failed\n\nexpected:\n${expected}\nactual:\n${actual}`);
  }
}

function stylelint() {
  stdout.write("stylelint... ");

  let actual;
  try {
    actual = execSync(
      "cat style.scss | pnpm stylelint --no-color --stdin-filename=style.scss",
      { stdio: "pipe" }
    ).toString();
  } catch (e) {
    actual = e.stderr.toString();
  }

  if (expectedStylelintOutput.trim() === actual.trim()) {
    console.log("✅");
  } else {
    process.exitCode = 1;
    console.error(
      `failed\n\nexpected:\n${expectedStylelintOutput}\nactual:\n${actual}`
    );
  }
}

function templateLint() {
  stdout.write("ember-template-lint... ");

  let actual;
  try {
    actual = execSync("pnpm ember-template-lint my-component.gjs").toString();
  } catch (e) {
    actual = e.stdout.toString();
  }

  if (expectedTemplateLintOutput.trim() === actual.trim()) {
    console.log("✅");
  } else {
    process.exitCode = 1;
    console.error(
      `failed\n\nexpected:\n${expectedTemplateLintOutput}\nactual:\n${actual}`
    );
  }
}

console.log("\ncjs:");
chdir("cjs");
eslint();
eslintAutofix();
prettier();
prettierScss();
stylelint();
templateLint();
chdir("..");

console.log("\ncjs theme:");
chdir("cjs-theme");
eslint();
eslintAutofix();
prettier();
prettierScss();
stylelint();
templateLint();
chdir("..");

console.log("eslint-rules");
chdir("eslint-rules");
execSync("pnpm test", { stdio: "inherit" });
chdir("..");

console.log("template-lint-rules");
chdir("template-lint-rules");
execSync("pnpm test", { stdio: "inherit" });
chdir("..");

console.log("stylelint-rules");
chdir("stylelint-rules");
execSync("pnpm test", { stdio: "inherit" });
chdir("..");

console.log("All tests done!");
