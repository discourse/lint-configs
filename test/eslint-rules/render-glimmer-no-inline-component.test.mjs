import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/render-glimmer-no-inline-component.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

const FILE = "plugins/foo/assets/javascripts/initializers/foo.gjs";
const errors = [{ messageId: "useModuleLevelComponent" }];

ruleTester.run("render-glimmer-no-inline-component", rule, {
  valid: [
    {
      filename: FILE,
      code: `
        const FooTemplate = <template><Foo @bar={{@data.bar}} /></template>;

        api.decorateCookedElement((element, helper) => {
          helper.renderGlimmer(element, FooTemplate, { bar });
        });
      `,
    },
    {
      filename: FILE,
      code: `
        import Foo from "./foo";

        api.decorateCookedElement((element, helper) => {
          helper.renderGlimmer(element, Foo, { bar });
        });
      `,
    },
    {
      filename: FILE,
      code: `
        class Foo extends Component {
          <template>{{@data.bar}}</template>
        }

        function decorate(element, helper) {
          helper.renderGlimmer(element, Foo);
        }
      `,
    },
    {
      // The component comes from somewhere the rule cannot follow
      filename: FILE,
      code: `
        function decorate(element, helper, component) {
          helper.renderGlimmer(element, component);
          helper.renderGlimmer(element, components[type]);
        }
      `,
    },
    {
      // Not `renderGlimmer`
      filename: FILE,
      code: `
        function initialize(api) {
          api.renderInOutlet("foo", <template>bar</template>);
        }
      `,
    },
    {
      // Test modules render a handful of times at most
      filename: "frontend/discourse/tests/integration/foo-test.gjs",
      code: `
        test("a", function () {
          helper.renderGlimmer(element, <template>bar</template>);
        });
      `,
    },
  ],
  invalid: [
    {
      filename: FILE,
      code: `
        api.decorateCookedElement((element, helper) => {
          helper.renderGlimmer(element, <template><Foo @bar={{bar}} /></template>);
        });
      `,
      errors,
    },
    {
      filename: FILE,
      code: `
        function decorate(element, { renderGlimmer }) {
          renderGlimmer(element, <template>bar</template>, { bar });
        }
      `,
      errors,
    },
    {
      filename: FILE,
      code: `
        function decorate(element, helper) {
          helper.renderGlimmer(
            element,
            class extends Component {
              <template>bar</template>
            }
          );
        }
      `,
      errors,
    },
    {
      filename: FILE,
      code: `
        function decorate(element, helper) {
          const FooTemplate = <template>bar</template>;
          helper.renderGlimmer(element, FooTemplate);
        }
      `,
      errors,
    },
    {
      filename: FILE,
      code: `
        function decorate(element, helper) {
          class Foo extends Component {
            <template>bar</template>
          }
          helper.renderGlimmer(element, Foo);
        }
      `,
      errors,
    },
  ],
});
