import { execSync } from "node:child_process";
import console from "node:console";
import { readFileSync } from "node:fs";
import process, { chdir, stdout } from "node:process";

const expectedEslintOutput = `
/path-prefix/my-component.gjs
  1:1  error  Run autofix to sort these imports!  simple-import-sort/imports

✖ 1 problem (1 error, 0 warnings)
  1 error and 0 warnings potentially fixable with the \`--fix\` option.
`;

const expectedEslintDecoratorsOutput = `
/path-prefix/object.js
  4:4  error  'computed' is not defined  no-undef

✖ 1 problem (1 error, 0 warnings)
`;

const expectedTemplateLintOutput = `
my-component.gjs
  18:4  error  Unexpected {{log}} usage.  no-log

✖ 1 problems (1 errors, 0 warnings)
`;

function eslint() {
  stdout.write("eslint... ");

  let actual;
  try {
    actual = execSync("pnpm eslint my-component.gjs").toString();
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

function eslintObjectDecorators() {
  stdout.write("eslint - decorators in object literals... ");

  let actual;
  try {
    actual = execSync("pnpm eslint object.js").toString();
  } catch (e) {
    actual = e.stdout.toString();
    actual = actual.replace(/^\/.+\/test\/(cjs|cjs-theme)\//m, "/path-prefix/");
  }

  if (expectedEslintDecoratorsOutput.trim() === actual.trim()) {
    console.log("✅");
  } else {
    process.exitCode = 1;
    console.error(
      `failed\n\nexpected:\n${expectedEslintDecoratorsOutput}\nactual:\n${actual}`
    );
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

function prettierDecorators() {
  stdout.write("prettier - decorators in object literals... ");

  const expected = readFileSync("object.js", "utf8");
  let actual;

  try {
    actual = execSync(
      "cat object.js | pnpm prettier --stdin-filepath=object.js"
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
eslintObjectDecorators();
prettier();
prettierDecorators();
prettierScss();
templateLint();
chdir("..");

console.log("\ncjs theme:");
chdir("cjs-theme");
eslint();
eslintAutofix();
eslintObjectDecorators();
prettier();
prettierDecorators();
prettierScss();
templateLint();
chdir("..");
