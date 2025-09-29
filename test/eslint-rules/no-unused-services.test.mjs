// Based on https://github.com/ember-cli/eslint-plugin-ember/blob/8e4b717c1d7d2c0555f4de807709156c89f7aa7a/tests/lib/rules/no-unused-services.js

import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-unused-services.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

const importString = `import { service } from "@ember/service";`;
const serviceName = "fooName";
const aliasImport = `import { alias } from "@ember/object/computed";`;
const renamedAliasImport = `import { alias as al } from "@ember/object/computed";`;
const eoImports = `import { computed, get, getProperties, observer } from "@ember/object";`;
const renamedEoImports = `import { computed as cp, get as g, getProperties as gp, observer as ob } from "@ember/object";`;
const observesImport = `import { observes } from "@ember-decorators/object";`;
const renamedObservesImport = `import {observes as obs} from "@ember-decorators/object";`;

function generateUseCasesFor(propertyName) {
  return [
    `this.${propertyName};`,
    `this.${propertyName}[0];`,
    `this.${propertyName}.prop;`,
    `this.${propertyName}.func();`,
    `this.get('${propertyName}');`,
    `this.get('${propertyName}.prop');`,
    `this.getProperties('a', '${propertyName}');`,
    `this.getProperties('a', '${propertyName}.prop');`,
    `this.getProperties(['a', '${propertyName}']);`,
    `this.getProperties(['a', '${propertyName}.prop']);`,
    `const { a, b, ${propertyName} } = this;`,
    `let { c, ${propertyName} : prop, d } = this;`,
  ];
}

function generateValid() {
  return generateUseCasesFor(serviceName).flatMap((use) => [
    `${importString} class MyClass { @service('foo') ${serviceName}; fooFunc() {${use}} }`,
    `${importString} class MyClass { @service() ${serviceName}; fooFunc() {${use}} }`,
    `${importString} class MyClass { @service() '${serviceName}'; fooFunc() {${use}} }`,
  ]);
}

function generateEmberObjectUseCasesFor(propertyName) {
  return [
    `get(this, '${propertyName}');`,
    `get(this, '${propertyName}.prop');`,
    `getProperties(this, 'a', '${propertyName}');`,
    `getProperties(this, 'a', '${propertyName}.prop');`,
    `getProperties(this, ['a', '${propertyName}']);`,
    `getProperties(this, ['a', '${propertyName}.prop']);`,
  ];
}

const unrelatedPropUses = generateUseCasesFor("unrelatedProp");
const edgeCases = ["let foo;", `this.prop.${serviceName};`];
const nonUses = [...unrelatedPropUses, ...edgeCases].join("");
const emberObjectUses1 = generateEmberObjectUseCasesFor(serviceName).join("");
const emberObjectUses2 =
  generateEmberObjectUseCasesFor("unrelatedProp").join("");

ruleTester.run("no-unused-services", rule, {
  valid: [
    ...generateValid(),
    `${importString}${aliasImport} class MyClass { @service() ${serviceName}; @alias('${serviceName}.prop') someAlias; }`,
    `${importString}${renamedAliasImport} class MyClass { @service() ${serviceName}; @al('${serviceName}.prop') someAlias; }`,
    `${importString}${eoImports} class MyClass { @service() ${serviceName}; @computed('${serviceName}.prop') get someComputed() {} }`,
    `${importString}${renamedEoImports} class MyClass { @service() ${serviceName}; @cp('${serviceName}.prop') get someComputed() {} }`,
    `${importString}${observesImport} class MyClass { @service() ${serviceName}; @observes('${serviceName}.prop') get someVal() {} }`,
    `${importString}${renamedObservesImport} class MyClass { @service() ${serviceName}; @obs('${serviceName}.prop') get someVal() {} }`,
    `class MyClass { @service ${serviceName}; }`,
    `class MyClass { @service("foo") bar; }`,
    `${importString} class MyClass {}`,
    "const foo = service();",
    `import ComputedProperty from "@ember/object/computed";`,
  ],
  invalid: [
    {
      code: `${importString} class MyClass { @service('foo') ${serviceName}; fooFunc() {${nonUses}} }`,
      output: null,
      errors: [
        {
          messageId: "main",
          suggestions: [
            {
              messageId: "removeServiceInjection",
              output: `${importString} class MyClass {  fooFunc() {${nonUses}} }`,
            },
          ],
        },
      ],
    },
    {
      code: `${importString} class MyClass { @service() ${serviceName}; fooFunc() {${nonUses}} }`,
      output: null,
      errors: [
        {
          messageId: "main",
          suggestions: [
            {
              messageId: "removeServiceInjection",
              output: `${importString} class MyClass {  fooFunc() {${nonUses}} }`,
            },
          ],
        },
      ],
    },
    /* Using get/getProperties without @ember/object import */
    {
      code: `${importString} class MyClass { @service() ${serviceName}; fooFunc() {${emberObjectUses1}} }`,
      output: null,
      errors: [
        {
          messageId: "main",
          suggestions: [
            {
              messageId: "removeServiceInjection",
              output: `${importString} class MyClass {  fooFunc() {${emberObjectUses1}} }`,
            },
          ],
        },
      ],
    },
    /* Using get/getProperties with @ember/object import for an unrelatedProp */
    {
      code: `${importString}${eoImports} class MyClass { @service() ${serviceName}; fooFunc() {${emberObjectUses2}} }`,
      output: null,
      errors: [
        {
          messageId: "main",
          suggestions: [
            {
              messageId: "removeServiceInjection",
              output: `${importString}${eoImports} class MyClass {  fooFunc() {${emberObjectUses2}} }`,
            },
          ],
        },
      ],
    },
    /* Using computed props and macros without the imports */
    {
      code: `${importString} class MyClass { @service() ${serviceName}; @alias('${serviceName}') someAlias; @computed('${serviceName}.prop') get someComputed() {} }`,
      output: null,
      errors: [
        {
          messageId: "main",
          suggestions: [
            {
              messageId: "removeServiceInjection",
              output: `${importString} class MyClass {  @alias('${serviceName}') someAlias; @computed('${serviceName}.prop') get someComputed() {} }`,
            },
          ],
        },
      ],
    },
    /* Using computed props and macros with the imports for an unrelatedProp */
    {
      code: `${importString}${eoImports}${aliasImport} class MyClass { @service() ${serviceName}; @alias('unrelatedProp', '${serviceName}') someAlias; @computed('unrelatedProp.prop') get someComputed() {} }`,
      output: null,
      errors: [
        {
          messageId: "main",
          suggestions: [
            {
              messageId: "removeServiceInjection",
              output: `${importString}${eoImports}${aliasImport} class MyClass {  @alias('unrelatedProp', '${serviceName}') someAlias; @computed('unrelatedProp.prop') get someComputed() {} }`,
            },
          ],
        },
      ],
    },
    {
      code: `${importString}${eoImports}${aliasImport} class MyClass { @service() ${serviceName}; @alias(${serviceName}) someAlias; @computed(${serviceName}) get someComputed() {} }`,
      output: null,
      errors: [
        {
          messageId: "main",
          suggestions: [
            {
              messageId: "removeServiceInjection",
              output: `${importString}${eoImports}${aliasImport} class MyClass {  @alias(${serviceName}) someAlias; @computed(${serviceName}) get someComputed() {} }`,
            },
          ],
        },
      ],
    },
    /* Using dummy macros that don't have dependent key props */
    {
      code: `${importString} import {foobar} from '@ember/object/computed'; class MyClass { @service() ${serviceName}; @foobar('${serviceName}') someFoobar; }`,
      output: null,
      errors: [
        {
          messageId: "main",
          suggestions: [
            {
              messageId: "removeServiceInjection",
              output: `${importString} import {foobar} from '@ember/object/computed'; class MyClass {  @foobar('${serviceName}') someFoobar; }`,
            },
          ],
        },
      ],
    },
    /* Multiple classes */
    {
      code: `${importString} class MyClass1 { @service() ${serviceName}; } class MyClass2 { fooFunc() {this.${serviceName};} }`,
      output: null,
      errors: [
        {
          messageId: "main",
          suggestions: [
            {
              messageId: "removeServiceInjection",
              output: `${importString} class MyClass1 {  } class MyClass2 { fooFunc() {this.${serviceName};} }`,
            },
          ],
        },
      ],
    },
    {
      code: `${importString} class MyClass1 { fooFunc() {this.${serviceName};} } class MyClass2 { @service() ${serviceName}; }`,
      output: null,
      errors: [
        {
          messageId: "main",
          suggestions: [
            {
              messageId: "removeServiceInjection",
              output: `${importString} class MyClass1 { fooFunc() {this.${serviceName};} } class MyClass2 {  }`,
            },
          ],
        },
      ],
    },
  ],
});
