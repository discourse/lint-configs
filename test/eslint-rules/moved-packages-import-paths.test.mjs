import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/moved-packages-import-paths.mjs";

const ruleTester = new RuleTester();

ruleTester.run("moved-packages-import-paths", rule, {
  valid: [
    `import MyComponent from "discourse/admin/components/my-component";`,
    `import DMenu from "discourse/float-kit/components/d-menu";`,
    `import ComboBox from "discourse/select-kit/components/combo-box";`,
    `import { eq } from "discourse/truth-helpers";`,
    `import DialogHolder from "discourse/dialog-holder/components/dialog-holder";`,
  ],
  invalid: [
    {
      code: `import MyComponent from "admin/components/my-component";`,
      errors: [
        {
          message:
            "Use 'discourse/admin/components/my-component' instead of 'admin/components/my-component'",
        },
      ],
      output: `import MyComponent from "discourse/admin/components/my-component";`,
    },
    {
      code: `import DMenu from "float-kit/components/d-menu";`,
      errors: [
        {
          message:
            "Use 'discourse/float-kit/components/d-menu' instead of 'float-kit/components/d-menu'",
        },
      ],
      output: `import DMenu from "discourse/float-kit/components/d-menu";`,
    },
    {
      code: `import ComboBox from "select-kit/components/combo-box";`,
      errors: [
        {
          message:
            "Use 'discourse/select-kit/components/combo-box' instead of 'select-kit/components/combo-box'",
        },
      ],
      output: `import ComboBox from "discourse/select-kit/components/combo-box";`,
    },
    {
      code: `import { eq } from "truth-helpers";`,
      errors: [
        {
          message: "Use 'discourse/truth-helpers' instead of 'truth-helpers'",
        },
      ],
      output: `import { eq } from "discourse/truth-helpers";`,
    },
    {
      code: `import DialogHolder from "dialog-holder/components/dialog-holder";`,
      errors: [
        {
          message:
            "Use 'discourse/dialog-holder/components/dialog-holder' instead of 'dialog-holder/components/dialog-holder'",
        },
      ],
      output: `import DialogHolder from "discourse/dialog-holder/components/dialog-holder";`,
    },
  ],
});
