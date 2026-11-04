import path from "node:path";
import { isTestFile } from "./utils/test-files.mjs";

function hasTestSuffix(filename) {
  return path.parse(filename).name.endsWith("-test");
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require test filenames to end with `-test`.",
    },
    schema: [], // no options
  },

  create(context) {
    return {
      Program(node) {
        const filename = context.filename;

        if (!isTestFile(filename)) {
          return;
        }

        if (!hasTestSuffix(filename)) {
          context.report({
            node,
            message: "Test filenames must end with `-test`.",
          });
        }
      },
    };
  },
};
