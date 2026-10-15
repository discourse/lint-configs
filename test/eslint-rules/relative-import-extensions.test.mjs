import { RuleTester } from "eslint";
import { join } from "node:path";
import rule from "../../lint-configs/eslint-rules/relative-import-extensions.mjs";

const ruleTester = new RuleTester();

const fixtures = join(
  import.meta.dirname,
  "fixtures",
  "relative-import-extensions"
);
const filename = join(fixtures, "importer.js");
const nestedFilename = join(fixtures, "folder", "importer.js");

function useExtension(specifier, fixed) {
  return [{ messageId: "useExtension", data: { specifier, fixed } }];
}

ruleTester.run("relative-import-extensions", rule, {
  valid: [
    {
      name: "a package import",
      code: `import { i18n } from "discourse-i18n";`,
      filename,
    },
    {
      name: "a relative import with a source extension",
      code: `import Component from "./component.gjs";`,
      filename,
    },
    {
      name: "a known extension, even when the file is missing",
      code: `import "./styles.scss";`,
      filename,
    },
    {
      name: "a query suffix",
      code: `import url from "./worker?url";`,
      filename,
    },
    {
      name: "a path that already names a file",
      code: `import logo from "./logo.svg";`,
      filename,
    },
    {
      name: "an export without a source",
      code: `const a = 1; export { a };`,
      filename,
    },
    {
      name: "a dynamic import of a template literal",
      code: "const name = 'helper'; import(`./${name}`);",
      filename,
    },
    {
      name: "an importSync call with the extension",
      code: `importSync("./helper.js");`,
      filename,
    },
    {
      name: "a call that is not importSync",
      code: `require("./helper");`,
      filename,
    },
  ],

  invalid: [
    {
      name: "a .js file",
      code: `import helper from "./helper";`,
      filename,
      output: `import helper from "./helper.js";`,
      errors: useExtension("./helper", "./helper.js"),
    },
    {
      name: "a .gjs file",
      code: `import Component from "./component";`,
      filename,
      output: `import Component from "./component.gjs";`,
      errors: useExtension("./component", "./component.gjs"),
    },
    {
      name: "a .ts file",
      code: `import service from "./service";`,
      filename,
      output: `import service from "./service.ts";`,
      errors: useExtension("./service", "./service.ts"),
    },
    {
      name: "a .gts file",
      code: `import TypedComponent from "./typed-component";`,
      filename,
      output: `import TypedComponent from "./typed-component.gts";`,
      errors: useExtension("./typed-component", "./typed-component.gts"),
    },
    {
      name: "a directory resolves to its index file",
      code: `import folder from "./folder";`,
      filename,
      output: `import folder from "./folder/index.js";`,
      errors: useExtension("./folder", "./folder/index.js"),
    },
    {
      name: "a directory with a trailing slash",
      code: `import folder from "./folder/";`,
      filename,
      output: `import folder from "./folder/index.js";`,
      errors: useExtension("./folder/", "./folder/index.js"),
    },
    {
      name: "a directory with a .gjs index file",
      code: `import GjsFolder from "./gjs-folder";`,
      filename,
      output: `import GjsFolder from "./gjs-folder/index.gjs";`,
      errors: useExtension("./gjs-folder", "./gjs-folder/index.gjs"),
    },
    {
      name: "a file wins over a directory of the same name",
      code: `import both from "./both";`,
      filename,
      output: `import both from "./both.js";`,
      errors: useExtension("./both", "./both.js"),
    },
    {
      name: "the current directory",
      code: `import folder from ".";`,
      filename: nestedFilename,
      output: `import folder from "./index.js";`,
      errors: useExtension(".", "./index.js"),
    },
    {
      name: "a parent directory",
      code: `import helper from "../helper";`,
      filename: nestedFilename,
      output: `import helper from "../helper.js";`,
      errors: useExtension("../helper", "../helper.js"),
    },
    {
      name: "a named re-export",
      code: `export { default } from "./helper";`,
      filename,
      output: `export { default } from "./helper.js";`,
      errors: useExtension("./helper", "./helper.js"),
    },
    {
      name: "a star re-export",
      code: `export * from "./helper";`,
      filename,
      output: `export * from "./helper.js";`,
      errors: useExtension("./helper", "./helper.js"),
    },
    {
      name: "a dynamic import",
      code: `import("./helper");`,
      filename,
      output: `import("./helper.js");`,
      errors: useExtension("./helper", "./helper.js"),
    },
    {
      name: "an importSync call",
      code: `importSync("./helper");`,
      filename,
      output: `importSync("./helper.js");`,
      errors: useExtension("./helper", "./helper.js"),
    },
    {
      name: "the fix keeps single quotes",
      code: `import helper from './helper';`,
      filename,
      output: `import helper from './helper.js';`,
      errors: useExtension("./helper", "./helper.js"),
    },
    {
      name: "a missing file is reported without a fix",
      code: `import missing from "./missing";`,
      filename,
      output: null,
      errors: [{ messageId: "addExtension", data: { specifier: "./missing" } }],
    },
  ],
});
