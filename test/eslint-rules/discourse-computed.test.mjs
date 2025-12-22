import EmberESLintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/discourse-computed.mjs";

const ruleTester = new RuleTester({
  languageOptions: { parser: EmberESLintParser }
});

ruleTester.run("discourse-computed", rule, {
  valid: [
    {
      name: "Working computed",
      code: [
        "import { computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"someProperty\")",
        "  get myComputed() {",
        "    return this.someProperty + 1;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "Working computed with nested property",
      code: [
        "import { computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"model.property\")",
        "  get myComputed() {",
        "    return this.model.property + 1;",
        "  }",
        "}"
      ].join("\n")
    }
  ],
  invalid: [
    {
      name: "discourseComputed with import",
      code: [
        "import { action } from \"@ember/object\";",
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"someProperty\")",
        "  myComputed(variable) {",
        "    return variable + 1;",
        "  }",
        "}"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        }
      ],
      output: [
        "import { action, computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"someProperty\")",
        "  get myComputed() {",
        "    return this.someProperty + 1;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with multiple decorators in import",
      code: [
        "import discourseComputed, { or } from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"someProperty\")",
        "  myComputed(someProperty) {",
        "    return someProperty + 1;",
        "  }",
        "}"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        }
      ],
      output: [
        "import { or } from \"discourse/lib/decorators\";",
        "import { computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"someProperty\")",
        "  get myComputed() {",
        "    return this.someProperty + 1;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with multiple arguments",
      code: [
        "import discourseComputed, { or } from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"somePropertyX\", \"somePropertyZ\", \"somePropertyY\")",
        "  myComputed(parameterX, parameterZ, parameterY) {",
        "    return { X: parameterX, Y: parameterY, Z: parameterZ };",
        "  }",
        "}"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        }
      ],
      output: [
        "import { or } from \"discourse/lib/decorators\";",
        "import { computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"somePropertyX\", \"somePropertyZ\", \"somePropertyY\")",
        "  get myComputed() {",
        "    return { X: this.somePropertyX, Y: this.somePropertyY, Z: this.somePropertyZ };",
        "  }",
        "}"
      ].join("\n")
    }, {
      name: "discourseComputed without arguments",
      code: [
        "import discourseComputed, { or } from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed",
        "  myComputed() {",
        "    return this.unreferencedValue;",
        "  }",
        "}"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        }
      ],
      output: [
        "import { or } from \"discourse/lib/decorators\";",
        "import { computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed",
        "  get myComputed() {",
        "    return this.unreferencedValue;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with nested property - no auto-fix",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"model.property\")",
        "  myComputed(modelProperty) {",
        "    return modelProperty + 1;",
        "  }",
        "}"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        }
      ],
      output: null
    },
    {
      name: "discourseComputed with multiple properties including nested - no auto-fix",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"simpleProperty\", \"model.nestedProperty\")",
        "  myComputed(simple, nested) {",
        "    return simple + nested;",
        "  }",
        "}"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        }
      ],
      output: null
    },
    {
      name: "mixing will fix / won't fix examples",
      code: [
        "import { action } from \"@ember/object\";",
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed",
        "  get myComputed() {",
        "    return this.unreferencedValue;",
        "  }",
        "",
        "  @discourseComputed(\"someProperty\")",
        "  myOtherComputed(someProperty) {",
        "    return someProperty + 1;",
        "  }",
        "",
        "  @discourseComputed(\"model.property\")",
        "  myDiscourseComputed(modelProperty) {",
        "    return modelProperty + 1;",
        "  }",
        "}"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        }
      ],
      output: [
        "import { action, computed } from \"@ember/object\";",
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @computed",
        "  get myComputed() {",
        "    return this.unreferencedValue;",
        "  }",
        "",
        "  @computed(\"someProperty\")",
        "  get myOtherComputed() {",
        "    return this.someProperty + 1;",
        "  }",
        "",
        "  @discourseComputed(\"model.property\")",
        "  myDiscourseComputed(modelProperty) {",
        "    return modelProperty + 1;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "Real world example with existing @ember/object/computed import",
      code: [
        "import Component from \"@ember/component\";",
        "import { alias } from \"@ember/object/computed\";",
        "import discourseComputed from \"discourse/lib/decorators\";",
        "",
        "export default class AdminReportTableCell extends Component {",
        "  options = null;",
        "",
        "  @alias(\"label.type\") type;",
        "",
        "  @discourseComputed(\"label\", \"data\", \"options\")",
        "  computedLabel(label, data, options) {",
        "    return label.compute(data, options || {});",
        "  }",
        "}"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        }
      ],
      output: [
        "import Component from \"@ember/component\";",
        "import { alias } from \"@ember/object/computed\";",
        "import { computed } from \"@ember/object\";",
        "",
        "export default class AdminReportTableCell extends Component {",
        "  options = null;",
        "",
        "  @alias(\"label.type\") type;",
        "",
        "  @computed(\"label\", \"data\", \"options\")",
        "  get computedLabel() {",
        "    return this.label.compute(this.data, this.options || {});",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed removed when computed already imported",
      code: [
        "import { computed } from \"@ember/object\";",
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"someProperty\")",
        "  myComputed(variable) {",
        "    return variable + 1;",
        "  }",
        "}"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        }
      ],
      output: [
        "import { computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"someProperty\")",
        "  get myComputed() {",
        "    return this.someProperty + 1;",
        "  }",
        "}"
      ].join("\n")
    },
  ]
});
