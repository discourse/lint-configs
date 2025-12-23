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
      name: "discourseComputed with nested property - auto-fix with optional chaining",
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
      output: [
        "import { computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"model.property\")",
        "  get myComputed() {",
        "    return this.model?.property + 1;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with multiple properties including nested - auto-fix with optional chaining",
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
      output: [
        "import { computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"simpleProperty\", \"model.nestedProperty\")",
        "  get myComputed() {",
        "    return this.simpleProperty + this.model?.nestedProperty;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "mixing fixable examples with parameter reassignments",
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
        "  @discourseComputed(\"title\")",
        "  titleLength(title) {",
        "    title = title || \"\";",
        "    return title.length;",
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
        "  @discourseComputed(\"title\")",
        "  titleLength(title) {",
        "    title = title || \"\";",
        "    return title.length;",
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
    {
      name: "discourseComputed with parameter name used as object key",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"someData\", \"displayMode\")",
        "  chartConfig(data, displayMode) {",
        "    return {",
        "      data: {",
        "        value: data",
        "      },",
        "      mode: displayMode",
        "    };",
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
        "  @computed(\"someData\", \"displayMode\")",
        "  get chartConfig() {",
        "    return {",
        "      data: {",
        "        value: this.someData",
        "      },",
        "      mode: this.displayMode",
        "    };",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with shorthand property",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"userId\", \"userName\")",
        "  userData(userId, userName) {",
        "    return { userId, userName };",
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
        "  @computed(\"userId\", \"userName\")",
        "  get userData() {",
        "    return { userId: this.userId, userName: this.userName };",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with default import only from @ember/object",
      code: [
        "import EmberObject from \"@ember/object\";",
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"basicNameValidation\", \"uniqueNameValidation\")",
        "  nameValidation(basicNameValidation, uniqueNameValidation) {",
        "    return uniqueNameValidation ? uniqueNameValidation : basicNameValidation;",
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
        "import EmberObject, { computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"basicNameValidation\", \"uniqueNameValidation\")",
        "  get nameValidation() {",
        "    return this.uniqueNameValidation ? this.uniqueNameValidation : this.basicNameValidation;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with default and named imports from @ember/object",
      code: [
        "import EmberObject, { action } from \"@ember/object\";",
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"value\")",
        "  myValue(value) {",
        "    return value + 1;",
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
        "import EmberObject, { action, computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"value\")",
        "  get myValue() {",
        "    return this.value + 1;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with computed already imported (after)",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "import { computed } from \"@ember/object\";",
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
    {
      name: "discourseComputed imported with different name",
      code: [
        "import myComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @myComputed(\"someProperty\")",
        "  myValue(someProperty) {",
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
        "import { computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"someProperty\")",
        "  get myValue() {",
        "    return this.someProperty + 1;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed as function call in classic Ember class - no auto-fix",
      code: [
        "import Component from \"@ember/component\";",
        "import discourseComputed from \"discourse/lib/decorators\";",
        "",
        "const EmberObjectComponent = Component.extend({",
        "  name: \"\",",
        "",
        "  text: discourseComputed(\"name\", function(name) {",
        "    return `hello, ${name}`;",
        "  }),",
        "});"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Cannot auto-fix discourseComputed in classic Ember classes. Please convert to native ES6 class first."
        }
      ],
      output: null
    },
    {
      name: "discourseComputed with parameter reassignment - no auto-fix",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"title\")",
        "  titleLength(title) {",
        "    title = title || \"\";",
        "    if (isHTMLSafe(title)) {",
        "      return title.toString().length;",
        "    }",
        "    return title.replace(/\\s+/gim, \" \").trim().length;",
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
      name: "discourseComputed imported with different name in classic class - no auto-fix",
      code: [
        "import Component from \"@ember/component\";",
        "import myComputed from \"discourse/lib/decorators\";",
        "",
        "const EmberObjectComponent = Component.extend({",
        "  name: \"\",",
        "",
        "  text: myComputed(\"name\", function(name) {",
        "    return `hello, ${name}`;",
        "  }),",
        "});"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Cannot auto-fix myComputed in classic Ember classes. Please convert to native ES6 class first."
        }
      ],
      output: null
    },
    {
      name: "mixed classic and ES6 classes - keep discourseComputed import",
      code: [
        "import Component from \"@ember/component\";",
        "import discourseComputed from \"discourse/lib/decorators\";",
        "",
        "const ClassicComponent = Component.extend({",
        "  classicProp: discourseComputed(\"name\", function(name) {",
        "    return name;",
        "  }),",
        "});",
        "",
        "class ModernComponent extends Component {",
        "  @discourseComputed(\"value\")",
        "  modernProp(value) {",
        "    return value + 1;",
        "  }",
        "}"
      ].join("\n"),
      errors: [
        {
          message:
            "Use 'import { computed } from \"@ember/object\";' instead of 'import discourseComputed from \"discourse/lib/decorators\";'."
        },
        {
          message: "Cannot auto-fix discourseComputed in classic Ember classes. Please convert to native ES6 class first."
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        }
      ],
      output: [
        "import Component from \"@ember/component\";",
        "import discourseComputed from \"discourse/lib/decorators\";",
        "import { computed } from \"@ember/object\";",
        "",
        "const ClassicComponent = Component.extend({",
        "  classicProp: discourseComputed(\"name\", function(name) {",
        "    return name;",
        "  }),",
        "});",
        "",
        "class ModernComponent extends Component {",
        "  @computed(\"value\")",
        "  get modernProp() {",
        "    return this.value + 1;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed imported as 'computed' conflicts with needed import",
      code: [
        "import computed, { debounce } from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @computed(\"someProperty\")",
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
        "import { debounce } from \"discourse/lib/decorators\";",
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
      name: "discourseComputed imported as 'computed' without named imports",
      code: [
        "import computed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @computed(\"someProperty\")",
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
      name: "multiple fixable decorators with computed name conflict",
      code: [
        "import computed, { debounce } from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @computed(\"foo.{bar,baz}\")",
        "  nestedComputed(foo) {",
        "    return foo.bar + foo.baz;",
        "  }",
        "",
        "  @computed(\"someProperty\")",
        "  normalComputed(someProperty) {",
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
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'."
        }
      ],
      output: [
        "import { debounce } from \"discourse/lib/decorators\";",
        "import { computed } from \"@ember/object\";",
        "class MyClass {",
        "  @computed(\"foo.{bar,baz}\")",
        "  get nestedComputed() {",
        "    return this.foo?.bar + this.foo?.baz;",
        "  }",
        "",
        "  @computed(\"someProperty\")",
        "  get normalComputed() {",
        "    return this.someProperty + 1;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "computed already imported with alias from @ember/object",
      code: [
        "import { computed as emberComputed } from \"@ember/object\";",
        "import discourseComputed from \"discourse/lib/decorators\";",
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
        "import { computed as emberComputed } from \"@ember/object\";",
        "class MyClass {",
        "  @emberComputed(\"someProperty\")",
        "  get myComputed() {",
        "    return this.someProperty + 1;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with nested properties - auto-fix with optional chaining",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"model.poll.title\", \"model.post.topic.title\")",
        "  title(pollTitle, topicTitle) {",
        "    return pollTitle ? htmlSafe(pollTitle) : topicTitle;",
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
        "  @computed(\"model.poll.title\", \"model.post.topic.title\")",
        "  get title() {",
        "    return this.model?.poll?.title ? htmlSafe(this.model?.poll?.title) : this.model?.post?.topic?.title;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with single nested property - auto-fix with optional chaining",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"user.profile.name\")",
        "  userName(name) {",
        "    return name.toUpperCase();",
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
        "  @computed(\"user.profile.name\")",
        "  get userName() {",
        "    return this.user?.profile?.name.toUpperCase();",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with @each - auto-fix with optional chaining to extracted path",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"items.@each.value\")",
        "  totalValue(items) {",
        "    return items.reduce((sum, item) => sum + item.value, 0);",
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
        "  @computed(\"items.@each.value\")",
        "  get totalValue() {",
        "    return this.items?.reduce((sum, item) => sum + item.value, 0);",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with [] - auto-fix with optional chaining to extracted path",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"categories.[]\")",
        "  categoryCount(categories) {",
        "    return categories.length;",
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
        "  @computed(\"categories.[]\")",
        "  get categoryCount() {",
        "    return this.categories?.length;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with {} - auto-fix with optional chaining to extracted path",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"foo.{bar,baz}\")",
        "  combined(foo) {",
        "    return foo.bar + foo.baz;",
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
        "  @computed(\"foo.{bar,baz}\")",
        "  get combined() {",
        "    return this.foo?.bar + this.foo?.baz;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with array element access - auto-fix with bracket notation",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"totalsForSample.1.value\", \"model.data.length\")",
        "  averageForSample(totals, count) {",
        "    const averageLabel = this.model.computedLabels.at(-1);",
        "    return averageLabel.compute({ y: (totals / count).toFixed(0) }).formattedValue;",
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
        "  @computed(\"totalsForSample.1.value\", \"model.data.length\")",
        "  get averageForSample() {",
        "    const averageLabel = this.model.computedLabels.at(-1);",
        "    return averageLabel.compute({ y: (this.totalsForSample?.[1]?.value / this.model?.data?.length).toFixed(0) }).formattedValue;",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with mixed nested and @each - auto-fix both with optional chaining",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"user.posts.@each.likes\", \"user.profile.totalLikes\")",
        "  likesInfo(posts, totalLikes) {",
        "    return { posts, totalLikes };",
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
        "  @computed(\"user.posts.@each.likes\", \"user.profile.totalLikes\")",
        "  get likesInfo() {",
        "    return { posts: this.user?.posts, totalLikes: this.user?.profile?.totalLikes };",
        "  }",
        "}"
      ].join("\n")
    },
    {
      name: "discourseComputed with deeply nested array access",
      code: [
        "import discourseComputed from \"discourse/lib/decorators\";",
        "class MyClass {",
        "  @discourseComputed(\"data.results.0.items.1.value\")",
        "  specificValue(value) {",
        "    return value * 2;",
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
        "  @computed(\"data.results.0.items.1.value\")",
        "  get specificValue() {",
        "    return this.data?.results?.[0]?.items?.[1]?.value * 2;",
        "  }",
        "}"
      ].join("\n")
    },
    // Note: Test for classic Ember classes (Component.extend) with @discourseComputed decorator
    // is not included here because the test environment doesn't have the Babel transformer
    // needed to parse decorator syntax on object properties. This functionality should be
    // tested manually in the actual Discourse codebase where the transformer is available.
  ]
});
