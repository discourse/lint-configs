import EmberESLintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/template-attribute-grouping.mjs";

const ruleTester = new RuleTester({
  languageOptions: { parser: EmberESLintParser },
});

ruleTester.run("template-attribute-grouping", rule, {
  valid: [
    {
      code: `
        <template>
          <DButton
            class="btn"
            data-test="x"
            ...attributes
            aria-label="after the splat"
            @action={{this.go}}
            @label="ok"
            {{on "mouseenter" this.enter}}
            {{on "click" this.click}}
          />
        </template>
      `,
    },
    {
      code: `
        <template>
          <div class="a" id="b" {{on "click" this.click}}></div>
          <Foo @a={{1}} @b={{2}} as |x|>{{x}}</Foo>
          <Foo @a={{1}}>{{yield}}</Foo>
          <div ...attributes></div>
        </template>
      `,
    },
    {
      // Modifiers keep their source order.
      code: `
        <template>
          <div {{didInsert this.setup}} {{on "click" this.click}} {{didUpdate this.refresh}}></div>
        </template>
      `,
    },
  ],
  invalid: [
    {
      // Arguments before attributes.
      code: `
        <template>
          <DButton @action={{this.go}} @label="ok" class="btn" />
        </template>
      `,
      errors: [{ messageId: "order" }],
      output: `
        <template>
          <DButton class="btn" @action={{this.go}} @label="ok" />
        </template>
      `,
    },
    {
      // Modifiers before attributes; their relative order is preserved.
      code: `
        <template>
          <div {{didInsert this.setup}} {{on "click" this.click}} class="a"></div>
        </template>
      `,
      errors: [{ messageId: "order" }],
      output: `
        <template>
          <div class="a" {{didInsert this.setup}} {{on "click" this.click}}></div>
        </template>
      `,
    },
    {
      // Arguments are alphabetical.
      code: `
        <template>
          <DButton @label="ok" @action={{this.go}} @icon="check" />
        </template>
      `,
      errors: [{ messageId: "order" }],
      output: `
        <template>
          <DButton @action={{this.go}} @icon="check" @label="ok" />
        </template>
      `,
    },
    {
      // Attributes are alphabetical on each side of the splat and never
      // cross it.
      code: `
        <template>
          <div id="b" class="a" ...attributes title="t" aria-label="l"></div>
        </template>
      `,
      errors: [{ messageId: "order" }],
      output: `
        <template>
          <div class="a" id="b" ...attributes aria-label="l" title="t"></div>
        </template>
      `,
    },
    {
      // Multi-line invocation: comments stay with the part that follows them.
      code: `
        <template>
          <DButton
            @label="ok"
            {{! explains the click handler }}
            {{on "click" this.click}}
            {{! explains the class }}
            class="btn"
            @action={{this.go}}
          />
        </template>
      `,
      errors: [{ messageId: "order" }],
      output: `
        <template>
          <DButton
            {{! explains the class }}
            class="btn"
            @action={{this.go}}
            @label="ok"
            {{! explains the click handler }}
            {{on "click" this.click}}
          />
        </template>
      `,
    },
    {
      // Block params are untouched.
      code: `
        <template>
          <Foo @b={{2}} class="a" @a={{1}} as |x|>{{x}}</Foo>
        </template>
      `,
      errors: [{ messageId: "order" }],
      output: `
        <template>
          <Foo class="a" @a={{1}} @b={{2}} as |x|>{{x}}</Foo>
        </template>
      `,
    },
    {
      // A comment that is the last thing in the tag stays in place.
      code: `
        <template>
          <div @a={{1}} class="a" {{! trailing note }}></div>
        </template>
      `,
      errors: [{ messageId: "order" }],
      output: `
        <template>
          <div class="a" @a={{1}} {{! trailing note }}></div>
        </template>
      `,
    },
  ],
});
