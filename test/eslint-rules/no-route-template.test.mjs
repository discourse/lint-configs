import EmberEslintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-route-template.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberEslintParser,
  },
});

ruleTester.run("no-route-template", rule, {
  valid: [
    `
    <template>
      Hello world
    </template>
    `,
  ],
  invalid: [
    {
      code: [
        `import RouteTemplate from "ember-route-template";`,
        `export default RouteTemplate(<template>Hello world</template>);`,
      ].join("\n"),
      errors: [
        {
          message: "Remove RouteTemplate wrapper for route templates.",
        },
      ],
      output: `\nexport default <template>Hello world</template>;`,
    },
    {
      code: [
        `import RouteTemplate from "ember-route-template";`,
        `import Component from "@glimmer/component";`,
        `export default RouteTemplate(class extends Component { <template>Hello world</template> });`,
      ].join("\n"),
      errors: [
        {
          message: "Remove RouteTemplate wrapper for route templates.",
        },
      ],
      output: [
        "",
        `import Component from "@glimmer/component";`,
        `export default class extends Component { <template>Hello world</template> };`,
      ].join("\n"),
    },
  ],
});
