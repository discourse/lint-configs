import path from "node:path";

/**
 * Whether the file lives in a QUnit test directory (`tests/unit`,
 * `test/javascripts/acceptance`, ...).
 *
 * @param {string} filename
 * @returns {boolean}
 */
export function isTestFile(filename) {
  return /tests?\/(javascripts\/)?(acceptance|integration|unit)/.test(filename);
}

/**
 * Whether the file is a `*-test` module anywhere under a `test/` or `tests/`
 * directory. Unlike `isTestFile`, this also covers plugin layouts such as
 * `test/javascripts/components/`.
 *
 * @param {string} filename
 * @returns {boolean}
 */
export function isTestModule(filename) {
  return (
    /(^|\/)tests?\//.test(filename) &&
    path.parse(filename).name.endsWith("-test")
  );
}
