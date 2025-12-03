import EmberESLintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/discourse-computed.mjs";

const ruleTester = new RuleTester({
  languageOptions: { parser: EmberESLintParser },
});

ruleTester.run("discourse-computed", rule, {
  valid: [
    {
      name: "Working computed",
      code: [
        'import { computed } from "@ember/object";',
        'class MyClass {',
        '  @computed("someProperty")',
        '  get myComputed() {',
        '    return this.someProperty + 1;',
        '  }',
        '}',
      ].join("\n"),
    },
  ],
  invalid: [
    {
      name: "discourseComputed with import",
      code: [
        'import discourseComputed from "discourse/lib/decorators";',
        'class MyClass {',
        '  @discourseComputed("someProperty")',
        '  myComputed(someProperty) {',
        '    return someProperty + 1;',
        '  }',
        '}',
      ].join("\n"),
      errors: [
        {
          message:
            'Use \'import { computed } from "@ember/object";\' instead of \'import discourseComputed from "discourse/lib/decorators";\'.',
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'.",
        },
      ],
      output: [
        'import { computed } from "@ember/object";',
        'class MyClass {',
        '  @computed("someProperty")',
        '  myComputed() {',
        '    return this.someProperty + 1;',
        '  }',
        '}',
      ].join("\n"),
    },
    {
      name: "discourseComputed with multiple decorators in import",
      code: [
        'import discourseComputed, { on } from "discourse/lib/decorators";',
        'class MyClass {',
        '  @discourseComputed("someProperty")',
        '  myComputed(someProperty) {',
        '    return someProperty + 1;',
        '  }',
        '}',
      ].join("\n"),
      errors: [
        {
          message:
            'Use \'import { computed } from "@ember/object";\' instead of \'import discourseComputed from "discourse/lib/decorators";\'.',
        },
        {
          message: "Use '@computed(...)' instead of '@discourseComputed(...)'.",
        },
      ],
      output: [
        'import { on } from "discourse/lib/decorators";',
        'import { computed } from "@ember/object";',
        'class MyClass {',
        '  @computed("someProperty")',
        '  myComputed() {',
        '    return this.someProperty + 1;',
        '  }',
        '}',
      ].join("\n"),
    },
  ],
});
