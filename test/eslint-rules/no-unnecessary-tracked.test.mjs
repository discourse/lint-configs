import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-unnecessary-tracked.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

ruleTester.run("no-unnecessary-tracked", rule, {
  valid: [
    {
      filename: "javascripts/discourse/components/foo-bar.gjs",
      code: `
        import Component from "@glimmer/component";

        export default class FooBar extends Component {
          @tracked status = "ready";

          mark() {
            this.status = "done";
          }

          <template>{{this.other}}</template>
        }
      `,
    },
    {
      filename: "javascripts/discourse/components/foo-bar.gjs",
      code: `
        import Component from "@glimmer/component";

        export default class FooBar extends Component {
          @tracked status = "ready";

          <template>
            <Something @onChange={{fn (mut this.status)}} />
          </template>
        }
      `,
    },
    {
      filename: "javascripts/discourse/components/foo-bar.gjs",
      code: `
        import Component from "@glimmer/component";

        export default class FooBar extends Component {
          @tracked status = "ready";

          <template>
            <Input @value={{this.status}} />
          </template>
        }
      `,
    },
    {
      filename: "javascripts/discourse/components/foo-bar.gjs",
      code: `
        import Component from "@glimmer/component";

        export default class FooBar extends Component {
          @tracked toggled = false;

          <template>
            <Input @type="checkbox" @checked={{this.toggled}} />
          </template>
        }
      `,
    },
    {
      filename: "javascripts/discourse/components/foo-bar.gjs",
      code: `
        import Component from "@glimmer/component";
        import ComboBox from "discourse/components/select-kit/combo-box";

        export default class FooBar extends Component {
          @tracked status = "ready";

          <template>
            <ComboBox @value={{this.status}} />
          </template>
        }
      `,
    },
    {
      filename: "frontend/discourse/app/service/baz.js",
      code: `
        class Baz extends Service {
          @tracked name;
        }
      `,
    },
  ],
  invalid: [
    {
      filename: "frontend/discourse/app/components/foo-bar.gjs",
      code: `
        import Component from "@glimmer/component";

        export default class FooBar extends Component {
          @tracked count = 0;

          <template>{{this.count}}</template>
        }
      `,
      errors: [
        {
          message: "`count` property is @tracked but isn't modified anywhere.",
        },
      ],
    },
  ],
});
