import EmberESLintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import DiscourseRecommended from "../../lint-configs/eslint.mjs";
import rule from "../../lint-configs/eslint-rules/sort-class-members.mjs";

const RULE_ID = "discourse/sort-class-members";
const options = DiscourseRecommended.find(
  (config) => config.rules?.[RULE_ID]
).rules[RULE_ID].slice(1);

const ruleTester = new RuleTester({
  languageOptions: { parser: EmberESLintParser },
});

ruleTester.run("sort-class-members", rule, {
  valid: [
    {
      options,
      code: `
        class Foo {
          static registry = new Map();

          static create() {}

          @service router;
          @optionalService chat;
          @controller topic;

          @tracked query = "";

          label = "x";

          #cache = null;
          _pending = null;

          constructor() {
            super();
          }

          init() {}

          willDestroy() {}

          get value() {
            return 1;
          }

          set value(v) {}

          @cached
          get items() {
            return [];
          }

          get title() {
            return "";
          }

          @action
          select() {}

          format() {}

          #compute() {}

          _legacy() {}

          <template>hi</template>
        }
      `,
    },
    {
      options,
      code: `
        class Foo {
          // one
          // two
          @action
          go() {}

          #inner() {} // trailing
        }
      `,
    },
  ],
  invalid: [
    {
      options,
      code: `
        class Foo {
          go() {}

          /**
           * Doc.
           */
          get value() {
            return 1;
          }
        }
      `,
      errors: [{ messageId: "order" }],
      output: `
        class Foo {
          /**
           * Doc.
           */
          get value() {
            return 1;
          }

          go() {}
        }
      `,
    },
    {
      options,
      code: `
        class Foo {
          #inner() {}

          go() {}
        }
      `,
      errors: [{ messageId: "order" }],
      output: `
        class Foo {
          go() {}

          #inner() {}
        }
      `,
    },
    {
      options,
      code: `
        class Foo {
          _legacy() {}

          #inner() {}
        }
      `,
      errors: [{ messageId: "order" }],
      output: `
        class Foo {
          #inner() {}

          _legacy() {}
        }
      `,
    },
    {
      // Multi-line comment runs, eslint directives and decorators travel with
      // the member they annotate.
      options,
      code: `
        class Foo {
          #inner() {}

          // first line of a note
          // second line of the note
          // eslint-disable-next-line no-console
          @action
          go() {
            console.log(1);
          }

          /**
           * Doc.
           */
          get value() {
            return 1;
          }
        }
      `,
      errors: 3,
      output: `
        class Foo {
          /**
           * Doc.
           */
          get value() {
            return 1;
          }

          // first line of a note
          // second line of the note
          // eslint-disable-next-line no-console
          @action
          go() {
            console.log(1);
          }

          #inner() {}
        }
      `,
    },
    {
      // A comment between the decorator and the key moves too.
      options,
      code: `
        class Foo {
          #inner() {}

          @action
          // why this is an action
          go() {}
        }
      `,
      errors: [{ messageId: "order" }],
      output: `
        class Foo {
          @action
          // why this is an action
          go() {}

          #inner() {}
        }
      `,
    },
    {
      // A trailing comment stays with the member whose line it ends.
      options,
      code: `
        class Foo {
          #inner() {} // keep me here

          go() {} // and me here
        }
      `,
      errors: [{ messageId: "order" }],
      output: `
        class Foo {
          go() {} // and me here

          #inner() {} // keep me here
        }
      `,
    },
    {
      // The template tag and static blocks are pinned in place.
      options,
      code: `
        class Foo {
          #inner() {}

          static {}

          go() {}

          <template>hi</template>
        }
      `,
      errors: [{ messageId: "order" }],
      output: `
        class Foo {
          go() {}

          static {}

          #inner() {}

          <template>hi</template>
        }
      `,
    },
    {
      // Accessor pairs are reordered as a unit.
      options,
      code: `
        class Foo {
          go() {}

          set value(v) {}

          get value() {
            return 1;
          }
        }
      `,
      errors: 2,
      output: `
        class Foo {
          get value() {
            return 1;
          }

          set value(v) {}

          go() {}
        }
      `,
    },
    {
      // Every problem in a class is fixed in a single pass.
      options,
      code: `
        class Foo {
          _legacy() {}

          #inner() {}

          @action
          go() {}

          get value() {
            return 1;
          }

          @tracked count = 0;

          @service router;
        }
      `,
      errors: 15,
      output: `
        class Foo {
          @service router;

          @tracked count = 0;

          get value() {
            return 1;
          }

          @action
          go() {}

          #inner() {}

          _legacy() {}
        }
      `,
    },
  ],
});
