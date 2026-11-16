import path from "node:path";

/**
 * Whether the file is a `*-test` module under a `test/` or `tests/` directory.
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
