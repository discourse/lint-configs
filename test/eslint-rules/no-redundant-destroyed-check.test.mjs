import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-redundant-destroyed-check.mjs";

const ruleTester = new RuleTester();

function glimmer(body) {
  return `import Component from "@glimmer/component";
export default class Foo extends Component {
${body}
}`;
}

ruleTester.run("no-redundant-destroyed-check", rule, {
  valid: [
    {
      name: "a lone isDestroying check",
      code: glimmer(`  run() { if (this.isDestroying) { return; } }`),
    },
    {
      name: "a lone isDestroyed check asks a different question",
      code: glimmer(`  run() { if (this.isDestroyed) { return; } }`),
    },
    {
      name: "a receiver other than this is not resolved",
      code: glimmer(
        `  run(owner) { if (owner.isDestroying || owner.isDestroyed) { return; } }`
      ),
    },
    {
      name: "receivers must match",
      code: glimmer(
        `  run() { if (this.isDestroying || this.args.owner.isDestroyed) { return; } }`
      ),
    },
    {
      name: "mixed polarity is not the pattern",
      code: glimmer(
        `  run() { if (this.isDestroying || !this.isDestroyed) { return; } }`
      ),
    },
    {
      name: "a class without a superclass",
      code: `class Foo {
  run() { if (this.isDestroying || this.isDestroyed) { return; } }
}`,
    },
    {
      name: "a superclass the rule cannot resolve",
      code: `import Base from "./base";
class Foo extends Base {
  run() { if (this.isDestroying || this.isDestroyed) { return; } }
}`,
    },
    {
      name: "a superclass from a module without the invariant",
      code: `import Modifier from "ember-modifier";
class Foo extends Modifier {
  run() { if (this.isDestroying || this.isDestroyed) { return; } }
}`,
    },
    {
      name: "this inside a nested function is a different this",
      code: glimmer(
        `  run() { return function () { return this.isDestroying || this.isDestroyed; }; }`
      ),
    },
    {
      name: "this inside an object literal method is a different this",
      code: glimmer(
        `  run() { return { go() { return this.isDestroying || this.isDestroyed; } }; }`
      ),
    },
    {
      name: "destroyable helpers that are not from @ember/destroyable",
      code: `function isDestroying() {}
function isDestroyed() {}
export function run(x) { return isDestroying(x) || isDestroyed(x); }`,
    },
    {
      name: "destroyable helpers with different arguments",
      code: `import { isDestroyed, isDestroying } from "@ember/destroyable";
export function run(a, b) { return isDestroying(a) || isDestroyed(b); }`,
    },
  ],

  invalid: [
    {
      name: "glimmer component disjunction",
      code: glimmer(
        `  run() { if (this.isDestroying || this.isDestroyed) { return; } }`
      ),
      output: glimmer(`  run() { if (this.isDestroying) { return; } }`),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "reversed operand order",
      code: glimmer(
        `  run() { if (this.isDestroyed || this.isDestroying) { return; } }`
      ),
      output: glimmer(`  run() { if (this.isDestroying) { return; } }`),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "negated conjunction",
      code: glimmer(
        `  run() { if (!this.isDestroying && !this.isDestroyed) { this.go(); } }`
      ),
      output: glimmer(`  run() { if (!this.isDestroying) { this.go(); } }`),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "pair at the end of a longer disjunction",
      code: glimmer(
        `  run() { if (!this.element || this.isDestroying || this.isDestroyed) { return; } }`
      ),
      output: glimmer(
        `  run() { if (!this.element || this.isDestroying) { return; } }`
      ),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "pair at the start of a longer disjunction",
      code: glimmer(
        `  run() { if (this.isDestroying || this.isDestroyed || this.busy) { return; } }`
      ),
      output: glimmer(
        `  run() { if (this.isDestroying || this.busy) { return; } }`
      ),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "isDestroyed leading a longer disjunction",
      code: glimmer(
        `  run() { if (this.isDestroyed || this.isDestroying || this.busy) { return; } }`
      ),
      output: glimmer(
        `  run() { if (this.isDestroying || this.busy) { return; } }`
      ),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "pair inside a longer negated conjunction",
      code: glimmer(
        `  run(navigatedAway) { if (!navigatedAway && !this.isDestroying && !this.isDestroyed) { this.go(); } }`
      ),
      output: glimmer(
        `  run(navigatedAway) { if (!navigatedAway && !this.isDestroying) { this.go(); } }`
      ),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "negated group",
      code: glimmer(
        `  run() { if (!(this.isDestroying || this.isDestroyed)) { this.go(); } }`
      ),
      output: glimmer(`  run() { if (!this.isDestroying) { this.go(); } }`),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "a mixed chain in an expression position",
      code: glimmer(
        `  get live() { return this.ready && !this.isDestroying && !this.isDestroyed; }`
      ),
      output: glimmer(
        `  get live() { return this.ready && !this.isDestroying; }`
      ),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "inside an arrow callback within a method",
      code: glimmer(
        `  run() { later(() => { if (this.isDestroying || this.isDestroyed) { return; } }); }`
      ),
      output: glimmer(
        `  run() { later(() => { if (this.isDestroying) { return; } }); }`
      ),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "inside a class field arrow",
      code: glimmer(
        `  run = () => { if (this.isDestroying || this.isDestroyed) { return; } };`
      ),
      output: glimmer(`  run = () => { if (this.isDestroying) { return; } };`),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "arrow returned from a nested arrow",
      code: glimmer(
        `  run() { return () => () => this.isDestroying || this.isDestroyed; }`
      ),
      output: glimmer(`  run() { return () => () => this.isDestroying; }`),
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "a service",
      code: `import Service from "@ember/service";
export default class Foo extends Service {
  run() { if (this.isDestroying || this.isDestroyed) { return; } }
}`,
      output: `import Service from "@ember/service";
export default class Foo extends Service {
  run() { if (this.isDestroying) { return; } }
}`,
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "a controller",
      code: `import Controller from "@ember/controller";
export default class Foo extends Controller {
  run() { if (this.isDestroying || this.isDestroyed) { return; } }
}`,
      output: `import Controller from "@ember/controller";
export default class Foo extends Controller {
  run() { if (this.isDestroying) { return; } }
}`,
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "a classic ember object",
      code: `import EmberObject from "@ember/object";
export default class Foo extends EmberObject {
  run() { if (this.isDestroying || this.isDestroyed) { return; } }
}`,
      output: `import EmberObject from "@ember/object";
export default class Foo extends EmberObject {
  run() { if (this.isDestroying) { return; } }
}`,
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "a classic component under a renamed import",
      code: `import Base from "@ember/component";
export default class Foo extends Base {
  run() { if (this.isDestroying || this.isDestroyed) { return; } }
}`,
      output: `import Base from "@ember/component";
export default class Foo extends Base {
  run() { if (this.isDestroying) { return; } }
}`,
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "a class expression",
      code: `import Component from "@glimmer/component";
export default class extends Component {
  run() { if (this.isDestroying || this.isDestroyed) { return; } }
}`,
      output: `import Component from "@glimmer/component";
export default class extends Component {
  run() { if (this.isDestroying) { return; } }
}`,
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "destroyable helpers need no class check",
      code: `import { isDestroyed, isDestroying } from "@ember/destroyable";
class Foo {
  run() { if (isDestroying(this) || isDestroyed(this)) { return; } }
}`,
      output: `import { isDestroying } from "@ember/destroyable";
class Foo {
  run() { if (isDestroying(this)) { return; } }
}`,
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "destroyable helpers on any receiver",
      code: `import { isDestroyed, isDestroying } from "@ember/destroyable";
export function run(owner) { return !isDestroying(owner) && !isDestroyed(owner); }`,
      output: `import { isDestroying } from "@ember/destroyable";
export function run(owner) { return !isDestroying(owner); }`,
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "the isDestroyed import survives when it has other uses",
      code: `import { isDestroyed, isDestroying, registerDestructor } from "@ember/destroyable";
export function run(owner) {
  if (isDestroying(owner) || isDestroyed(owner)) { return; }
  return isDestroyed(owner);
}`,
      output: `import { isDestroyed, isDestroying, registerDestructor } from "@ember/destroyable";
export function run(owner) {
  if (isDestroying(owner)) { return; }
  return isDestroyed(owner);
}`,
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "an import left empty is removed with its line",
      code: `import { isDestroyed } from "@ember/destroyable";
import { isDestroying } from "@ember/destroyable";
export function run(owner) { return isDestroying(owner) || isDestroyed(owner); }`,
      output: `import { isDestroying } from "@ember/destroyable";
export function run(owner) { return isDestroying(owner); }`,
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "a renamed helper import is matched by its imported name",
      code: `import { isDestroyed as gone, isDestroying as going } from "@ember/destroyable";
export function run(owner) { return going(owner) || gone(owner); }`,
      output: `import { isDestroying as going } from "@ember/destroyable";
export function run(owner) { return going(owner); }`,
      errors: [{ messageId: "redundant" }],
    },
    {
      name: "two independent pairs in one method",
      code: glimmer(`  run() {
    if (this.isDestroying || this.isDestroyed) { return; }
    later(() => { if (!this.isDestroying && !this.isDestroyed) { this.go(); } });
  }`),
      output: glimmer(`  run() {
    if (this.isDestroying) { return; }
    later(() => { if (!this.isDestroying) { this.go(); } });
  }`),
      errors: [{ messageId: "redundant" }, { messageId: "redundant" }],
    },
    {
      name: "inverted guard is reported without a fix",
      code: glimmer(
        `  run() { if (!this.isDestroying || !this.isDestroyed) { this.go(); } }`
      ),
      output: null,
      errors: [{ messageId: "inverted" }],
    },
  ],
});
