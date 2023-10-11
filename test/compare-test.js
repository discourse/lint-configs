import { readFileSync } from "fs";
import { execSync } from "child_process";
import { stdout } from "process";

const expectedEslintOutput = `
/path-prefix/my-component.gjs
  16:4  error  Expected property currentUser to come before property __GLIMMER_TEMPLATE  sort-class-members/sort-class-members

✖ 1 problem (1 error, 0 warnings)
  1 error and 0 warnings potentially fixable with the \`--fix\` option.
`;

const expectedTemplateLintOutput = `
my-component.gjs
  13:4  error  Unexpected {{log}} usage.  no-log

✖ 1 problems (1 errors, 0 warnings)
`;

function eslint() {
  stdout.write("eslint... ");

  let actual;
  try {
    actual = execSync("yarn --silent eslint my-component.gjs").toString();
  } catch (e) {
    actual = e.stdout.toString();
    actual = actual.replace(/^\/.+\/test\//m, "/path-prefix/");
  }

  if (expectedEslintOutput.trim() === actual.trim()) {
    console.log("ok");
  } else {
    console.error(
      `failed\n\nexpected:\n${expectedEslintOutput}\nactual:\n${actual}`,
    );
  }
}

function prettier() {
  stdout.write("prettier... ");

  const expected = readFileSync("formatted-my-component.gjs", "utf8");
  let actual;

  try {
    actual = execSync("yarn --silent prettier my-component.gjs").toString();
  } catch (e) {
    actual = e.stdout.toString();
  }

  if (expected.trim() === actual.trim()) {
    console.log("ok");
  } else {
    console.error(`failed\n\nexpected:\n${expected}\nactual:\n${actual}`);
  }
}

function templateLint() {
  stdout.write("ember-template-lint... ");

  let actual;
  try {
    actual = execSync(
      "yarn --silent ember-template-lint my-component.gjs",
    ).toString();
  } catch (e) {
    actual = e.stdout.toString();
  }

  if (expectedTemplateLintOutput.trim() === actual.trim()) {
    console.log("ok");
  } else {
    console.error(
      `failed\n\nexpected:\n${expectedTemplateLintOutput}\nactual:\n${actual}`,
    );
  }
}

eslint();
prettier();
templateLint();
