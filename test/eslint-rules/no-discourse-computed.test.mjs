import EmberESLintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-discourse-computed.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberESLintParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      ecmaFeatures: {
        legacyDecorators: true,
        // Enable class fields parsing so tests with class properties work reliably
        classFields: true,
      },
    },
  },
});

ruleTester.run("no-discourse-computed", rule, {
  valid: [
    {
      name: "Working computed",
      code: `import { computed } from "@ember/object";
class MyClass {
  @computed("someProperty")
  get myComputed() {
    return this.someProperty + 1;
  }
}`,
    },
    {
      name: "Working computed with nested property",
      code: `import { computed } from "@ember/object";
class MyClass {
  @computed("model.property")
  get myComputed() {
    return this.model.property + 1;
  }
}`,
    },
  ],
  invalid: [
    {
      name: "discourseComputed with import",
      code: `import { action } from "@ember/object";
import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("someProperty")
  myComputed(variable) {
    return variable + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { action, computed } from "@ember/object";
class MyClass {
  @computed("someProperty")
  get myComputed() {
    return this.someProperty + 1;
  }
}`,
    },
    {
      name: "discourseComputed with multiple decorators in import",
      code: `import discourseComputed, { or } from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("someProperty")
  myComputed(someProperty) {
    return someProperty + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { or } from "discourse/lib/decorators";
import { computed } from "@ember/object";
class MyClass {
  @computed("someProperty")
  get myComputed() {
    return this.someProperty + 1;
  }
}`,
    },
    {
      name: "discourseComputed with multiple arguments",
      code: `import discourseComputed, { or } from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("somePropertyX", "somePropertyZ", "somePropertyY")
  myComputed(parameterX, parameterZ, parameterY) {
    return { X: parameterX, Y: parameterY, Z: parameterZ };
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { or } from "discourse/lib/decorators";
import { computed } from "@ember/object";
class MyClass {
  @computed("somePropertyX", "somePropertyZ", "somePropertyY")
  get myComputed() {
    return { X: this.somePropertyX, Y: this.somePropertyY, Z: this.somePropertyZ };
  }
}`,
    },
    {
      name: "discourseComputed without arguments",
      code: `import discourseComputed, { or } from "discourse/lib/decorators";
class MyClass {
  @discourseComputed
  myComputed() {
    return this.unreferencedValue;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { or } from "discourse/lib/decorators";
import { computed } from "@ember/object";
class MyClass {
  @computed
  get myComputed() {
    return this.unreferencedValue;
  }
}`,
    },
    {
      name: "discourseComputed with nested property - auto-fix with optional chaining",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("model.property")
  myComputed(modelProperty) {
    return modelProperty + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("model.property")
  get myComputed() {
    return this.model?.property + 1;
  }
}`,
    },
    {
      name: "discourseComputed with multiple properties including nested - auto-fix with optional chaining",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("simpleProperty", "model.nestedProperty")
  myComputed(simple, nested) {
    return simple + nested;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("simpleProperty", "model.nestedProperty")
  get myComputed() {
    return this.simpleProperty + this.model?.nestedProperty;
  }
}`,
    },
    {
      name: "mixing fixable examples with parameter reassignments",
      code: `import { action } from "@ember/object";
import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed
  get myComputed() {
    return this.unreferencedValue;
  }

  @discourseComputed("someProperty")
  myOtherComputed(someProperty) {
    return someProperty + 1;
  }

  @discourseComputed("title")
  titleLength(title) {
    title = title || "";
    return title.length;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
        { messageId: "replaceDecorator" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { action, computed } from "@ember/object";
class MyClass {
  @computed
  get myComputed() {
    return this.unreferencedValue;
  }

  @computed("someProperty")
  get myOtherComputed() {
    return this.someProperty + 1;
  }

  @computed("title")
  get titleLength() {
    const title = this.title || "";
    return title.length;
  }
}`,
    },
    {
      name: "Real world example with existing @ember/object/computed import",
      code: `import Component from "@ember/component";
import { alias } from "@ember/object/computed";
import discourseComputed from "discourse/lib/decorators";

export default class AdminReportTableCell extends Component {
  options = null;

  @alias("label.type") type;

  @discourseComputed("label", "data", "options")
  computedLabel(label, data, options) {
    return label.compute(data, options || {});
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import Component from "@ember/component";
import { alias } from "@ember/object/computed";
import { computed } from "@ember/object";

export default class AdminReportTableCell extends Component {
  options = null;

  @alias("label.type") type;

  @computed("label", "data", "options")
  get computedLabel() {
    return this.label.compute(this.data, this.options || {});
  }
}`,
    },
    {
      name: "discourseComputed removed when computed already imported",
      code: `import { computed } from "@ember/object";
import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("someProperty")
  myComputed(variable) {
    return variable + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("someProperty")
  get myComputed() {
    return this.someProperty + 1;
  }
}`,
    },
    {
      name: "discourseComputed with parameter name used as object key",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("someData", "displayMode")
  chartConfig(data, displayMode) {
    return {
      data: {
        value: data
      },
      mode: displayMode
    };
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("someData", "displayMode")
  get chartConfig() {
    return {
      data: {
        value: this.someData
      },
      mode: this.displayMode
    };
  }
}`,
    },
    {
      name: "discourseComputed with shorthand property",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("userId", "userName")
  userData(userId, userName) {
    return { userId, userName };
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("userId", "userName")
  get userData() {
    return { userId: this.userId, userName: this.userName };
  }
}`,
    },
    {
      name: "discourseComputed with default import only from @ember/object",
      code: `import EmberObject from "@ember/object";
import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("basicNameValidation", "uniqueNameValidation")
  nameValidation(basicNameValidation, uniqueNameValidation) {
    return uniqueNameValidation ? uniqueNameValidation : basicNameValidation;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import EmberObject, { computed } from "@ember/object";
class MyClass {
  @computed("basicNameValidation", "uniqueNameValidation")
  get nameValidation() {
    return this.uniqueNameValidation ? this.uniqueNameValidation : this.basicNameValidation;
  }
}`,
    },
    {
      name: "discourseComputed with default and named imports from @ember/object",
      code: `import EmberObject, { action } from "@ember/object";
import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("value")
  myValue(value) {
    return value + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import EmberObject, { action, computed } from "@ember/object";
class MyClass {
  @computed("value")
  get myValue() {
    return this.value + 1;
  }
}`,
    },
    {
      name: "discourseComputed with computed already imported (after)",
      code: `import discourseComputed from "discourse/lib/decorators";
import { computed } from "@ember/object";
class MyClass {
  @discourseComputed("someProperty")
  myComputed(variable) {
    return variable + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("someProperty")
  get myComputed() {
    return this.someProperty + 1;
  }
}`,
    },
    {
      name: "discourseComputed imported with different name",
      code: `import myComputed from "discourse/lib/decorators";
class MyClass {
  @myComputed("someProperty")
  myValue(someProperty) {
    return someProperty + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("someProperty")
  get myValue() {
    return this.someProperty + 1;
  }
}`,
    },
    {
      name: "discourseComputed as function call in classic Ember class - no auto-fix",
      code: `import Component from "@ember/component";
import discourseComputed from "discourse/lib/decorators";

const EmberObjectComponent = Component.extend({
  name: "",

  text: discourseComputed("name", function(name) {
    return \`hello, \${name}\`;
  }),
});`,
      errors: [
        { messageId: "replaceImport" },
        {
          messageId: "cannotAutoFixClassic",
        },
      ],
      output: null,
    },
    {
      name: "discourseComputed with simple parameter reassignment - auto-fix with const",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("title")
  titleLength(title) {
    title = title || "";
    if (isHTMLSafe(title)) {
      return title.toString().length;
    }
    return title.replace(/\s+/gim, " ").trim().length;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("title")
  get titleLength() {
    const title = this.title || "";
    if (isHTMLSafe(title)) {
      return title.toString().length;
    }
    return title.replace(/\s+/gim, " ").trim().length;
  }
}`,
    },
    {
      name: "discourseComputed imported with different name in classic class - no auto-fix",
      code: `import Component from "@ember/component";
import myComputed from "discourse/lib/decorators";

const EmberObjectComponent = Component.extend({
  name: "",

  text: myComputed("name", function(name) {
    return \`hello, \${name}\`;
  }),
});`,
      errors: [
        { messageId: "replaceImport" },
        {
          messageId: "cannotAutoFixClassic",
        },
      ],
      output: null,
    },
    {
      name: "mixed classic and ES6 classes - keep discourseComputed import",
      code: `import Component from "@ember/component";
import discourseComputed from "discourse/lib/decorators";

const ClassicComponent = Component.extend({
  classicProp: discourseComputed("name", function(name) {
    return name;
  }),
});

class ModernComponent extends Component {
  @discourseComputed("value")
  modernProp(value) {
    return value + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        {
          messageId: "cannotAutoFixClassic",
        },
        { messageId: "replaceDecorator" },
      ],
      output: `import Component from "@ember/component";
import discourseComputed from "discourse/lib/decorators";
import { computed } from "@ember/object";

const ClassicComponent = Component.extend({
  classicProp: discourseComputed("name", function(name) {
    return name;
  }),
});

class ModernComponent extends Component {
  @computed("value")
  get modernProp() {
    return this.value + 1;
  }
}`,
    },
    {
      name: "discourseComputed imported as 'computed' conflicts with needed import",
      code: `import computed, { debounce } from "discourse/lib/decorators";
class MyClass {
  @computed("someProperty")
  myComputed(someProperty) {
    return someProperty + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { debounce } from "discourse/lib/decorators";
import { computed } from "@ember/object";
class MyClass {
  @computed("someProperty")
  get myComputed() {
    return this.someProperty + 1;
  }
}`,
    },
    {
      name: "discourseComputed imported as 'computed' without named imports",
      code: `import computed from "discourse/lib/decorators";
class MyClass {
  @computed("someProperty")
  myComputed(someProperty) {
    return someProperty + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("someProperty")
  get myComputed() {
    return this.someProperty + 1;
  }
}`,
    },
    {
      name: "multiple fixable decorators with computed name conflict",
      code: `import computed, { debounce } from "discourse/lib/decorators";
class MyClass {
  @computed("foo.{bar,baz}")
  nestedComputed(foo) {
    return foo.bar + foo.baz;
  }

  @computed("someProperty")
  normalComputed(someProperty) {
    return someProperty + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { debounce } from "discourse/lib/decorators";
import { computed } from "@ember/object";
class MyClass {
  @computed("foo.{bar,baz}")
  get nestedComputed() {
    return this.foo?.bar + this.foo?.baz;
  }

  @computed("someProperty")
  get normalComputed() {
    return this.someProperty + 1;
  }
}`,
    },
    {
      name: "computed already imported with alias from @ember/object",
      code: `import { computed as emberComputed } from "@ember/object";
import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("someProperty")
  myComputed(someProperty) {
    return someProperty + 1;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed as emberComputed } from "@ember/object";
class MyClass {
  @emberComputed("someProperty")
  get myComputed() {
    return this.someProperty + 1;
  }
}`,
    },
    {
      name: "discourseComputed with nested properties - auto-fix with optional chaining",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("model.poll.title", "model.post.topic.title")
  title(pollTitle, topicTitle) {
    return pollTitle ? htmlSafe(pollTitle) : topicTitle;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("model.poll.title", "model.post.topic.title")
  get title() {
    return this.model?.poll?.title ? htmlSafe(this.model?.poll?.title) : this.model?.post?.topic?.title;
  }
}`,
    },
    {
      name: "discourseComputed with single nested property - auto-fix with optional chaining",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("user.profile.name")
  userName(name) {
    return name.toUpperCase();
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("user.profile.name")
  get userName() {
    return this.user?.profile?.name?.toUpperCase();
  }
}`,
    },
    {
      name: "discourseComputed with @each - auto-fix with optional chaining to extracted path",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("items.@each.value")
  totalValue(items) {
    return items.reduce((sum, item) => sum + item.value, 0);
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("items.@each.value")
  get totalValue() {
    return this.items?.reduce((sum, item) => sum + item.value, 0);
  }
}`,
    },
    {
      name: "discourseComputed with [] - auto-fix with optional chaining to extracted path",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("categories.[]")
  categoryCount(categories) {
    return categories.length;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("categories.[]")
  get categoryCount() {
    return this.categories?.length;
  }
}`,
    },
    {
      name: "discourseComputed with {} - auto-fix with optional chaining to extracted path",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("foo.{bar,baz}")
  combined(foo) {
    return foo.bar + foo.baz;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("foo.{bar,baz}")
  get combined() {
    return this.foo?.bar + this.foo?.baz;
  }
}`,
    },
    {
      name: "discourseComputed with array element access - auto-fix with bracket notation",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("totalsForSample.1.value", "model.data.length")
  averageForSample(totals, count) {
    const averageLabel = this.model.computedLabels.at(-1);
    return averageLabel.compute({ y: (totals / count).toFixed(0) }).formattedValue;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("totalsForSample.1.value", "model.data.length")
  get averageForSample() {
    const averageLabel = this.model.computedLabels.at(-1);
    return averageLabel.compute({ y: (this.totalsForSample?.[1]?.value / this.model?.data?.length).toFixed(0) }).formattedValue;
  }
}`,
    },
    {
      name: "discourseComputed with mixed nested and @each - auto-fix both with optional chaining",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("user.posts.@each.likes", "user.profile.totalLikes")
  likesInfo(posts, totalLikes) {
    return { posts, totalLikes };
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("user.posts.@each.likes", "user.profile.totalLikes")
  get likesInfo() {
    return { posts: this.user?.posts, totalLikes: this.user?.profile?.totalLikes };
  }
}`,
    },
    {
      name: "discourseComputed with deeply nested array access",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("data.results.0.items.1.value")
  specificValue(value) {
    return value * 2;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("data.results.0.items.1.value")
  get specificValue() {
    return this.data?.results?.[0]?.items?.[1]?.value * 2;
  }
}`,
    },
    {
      name: "discourseComputed with .[] returning parameter directly",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("sortedData.[]", "perPage", "page")
  paginatedData(data, perPage, page) {
    if (perPage < data.length) {
      const start = perPage * page;
      return data.slice(start, start + perPage);
    }
    return data;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("sortedData.[]", "perPage", "page")
  get paginatedData() {
    if (this.perPage < this.sortedData?.length) {
      const start = this.perPage * this.page;
      return this.sortedData?.slice(start, start + this.perPage);
    }
    return this.sortedData;
  }
}`,
    },
    {
      name: "discourseComputed with .[] in filter callback",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("choices.[]", "collection.[]")
  filteredChoices(choices, collection) {
    return makeArray(choices).filter((i) => !collection.includes(i));
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("choices.[]", "collection.[]")
  get filteredChoices() {
    return makeArray(this.choices).filter((i) => !this.collection?.includes(i));
  }
}`,
    },
    {
      name: "discourseComputed with .[] and multiline member expression",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("words.[]")
  processedWords(words) {
    return words
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 3);
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("words.[]")
  get processedWords() {
    return this.words
      ?.map((w) => w.toLowerCase())
      ?.filter((w) => w.length > 3);
  }
}`,
    },
    {
      name: "discourseComputed with spread operator - no auto-fix (requires manual intervention)",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("model.groups")
  availableGroups(groups) {
    return [
      {
        id: null,
        name: "no-group",
      },
      ...groups,
    ];
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        {
          messageId: "cannotAutoFixSpread",
        },
      ],
      output: null,
    },
    {
      name: "discourseComputed with spread operator on nested property - no auto-fix",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("data.items")
  allItems(items) {
    return [...items, "extra"];
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        {
          messageId: "cannotAutoFixSpread",
        },
      ],
      output: null,
    },
    {
      name: "discourseComputed with parameter in unsafe spread (no fallback) - no auto-fix",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("items")
  allItems(items) {
    return [...items, this.defaultItem];
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        {
          messageId: "cannotAutoFixSpread",
        },
      ],
      output: null,
    },
    {
      name: "discourseComputed with update expression - no auto-fix",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("count")
  incrementCount(count) {
    count++;
    return count;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        {
          messageId: "cannotAutoFixUpdateExpression",
        },
      ],
      output: null,
    },
    {
      name: "discourseComputed with nested reassignment - no auto-fix",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("value")
  processValue(value) {
    if (someCondition) {
      value = value || 0;
    }
    return value * 2;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        {
          messageId: "cannotAutoFixNestedReassignment",
        },
      ],
      output: null,
    },
    {
      name: "discourseComputed with multiple simple reassignments - auto-fix with let",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("status")
  statusMessage(status) {
    status = status || "pending";
    if (status === "pending") {
      status = "waiting";
    }
    return status;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("status")
  get statusMessage() {
    let status = this.status || "pending";
    if (status === "pending") {
      status = "waiting";
    }
    return status;
  }
}`,
    },
    {
      name: "discourseComputed with multiple consecutive reassignments - auto-fix all",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("suspended_till", "suspended_at")
  suspendDuration(suspendedTill, suspendedAt) {
    suspendedAt = moment(suspendedAt);
    suspendedTill = moment(suspendedTill);
    return suspendedAt.format("L") + " - " + suspendedTill.format("L");
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("suspended_till", "suspended_at")
  get suspendDuration() {
    const suspendedAt = moment(this.suspended_at);
    const suspendedTill = moment(this.suspended_till);
    return suspendedAt.format("L") + " - " + suspendedTill.format("L");
  }
}`,
    },
    {
      name: "discourseComputed with unsafe optional chaining in member expression - no auto-fix",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("item.draft_username", "item.username")
  userUrl(draftUsername, username) {
    return userPath((draftUsername || username).toLowerCase());
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        {
          messageId: "cannotAutoFixUnsafeOptionalChaining",
        },
      ],
      output: null,
    },
    {
      name: "discourseComputed with nested property in conditional expression used in member access - no auto-fix",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("model.firstName", "model.lastName")
  fullName(firstName, lastName) {
    return (firstName || lastName).toUpperCase();
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        {
          messageId: "cannotAutoFixUnsafeOptionalChaining",
        },
      ],
      output: null,
    },
    {
      name: "discourseComputed with nested property and safe literal fallback - auto-fix OK",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("siteSettings.dashboard_general_tab_activity_metrics")
  activityMetrics(metrics) {
    return (metrics || "").split("|").filter(Boolean);
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("siteSettings.dashboard_general_tab_activity_metrics")
  get activityMetrics() {
    return (this.siteSettings?.dashboard_general_tab_activity_metrics || "").split("|").filter(Boolean);
  }
}`,
    },
    {
      name: "discourseComputed with nested property and safe nullish coalescing fallback - auto-fix OK",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("model.value")
  formattedValue(value) {
    return (value ?? 0).toFixed(2);
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("model.value")
  get formattedValue() {
    return (this.model?.value ?? 0).toFixed(2);
  }
}`,
    },
    {
      name: "discourseComputed with nested property used directly in member expression - auto-fix OK (safe)",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("item.username")
  userUrl(username) {
    return username.toLowerCase();
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("item.username")
  get userUrl() {
    return this.item?.username?.toLowerCase();
  }
}`,
    },
    {
      name: "discourseComputed with parameter used in nested function - no auto-fix",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("displayMode")
  chartConfig(displayMode) {
    return {
      formatter(value) {
        if (displayMode === "percentage") {
          return value + "%";
        }
        return value;
      }
    };
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        {
          messageId: "cannotAutoFixNestedFunction",
        },
      ],
      output: null,
    },
    {
      name: "discourseComputed with parameter in arrow function - auto-fix OK",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("displayMode")
  chartConfig(displayMode) {
    return {
      formatter: (value) => {
        if (displayMode === "percentage") {
          return value + "%";
        }
        return value;
      }
    };
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("displayMode")
  get chartConfig() {
    return {
      formatter: (value) => {
        if (this.displayMode === "percentage") {
          return value + "%";
        }
        return value;
      }
    };
  }
}`,
    },
    {
      name: "discourseComputed with guard clause reassignment - auto-fix with let",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("items")
  total(items) {
    if (!items) { items = []; }
    return items.length;
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("items")
  get total() {
    let items = this.items || [];
    return items.length;
  }
}`,
    },
    {
      name: "discourseComputed with nested property used in method call - optional chaining before method",
      code: `import discourseComputed from "discourse/lib/decorators";
class MyClass {
  @discourseComputed("model.poll.options")
  totalVotes(options) {
    return options.reduce((sum, option) => sum + option.votes, 0);
  }
}`,
      errors: [
        { messageId: "replaceImport" },
        { messageId: "replaceDecorator" },
      ],
      output: `import { computed } from "@ember/object";
class MyClass {
  @computed("model.poll.options")
  get totalVotes() {
    return this.model?.poll?.options?.reduce((sum, option) => sum + option.votes, 0);
  }
}`,
    },
    // Note: Test for classic Ember classes (Component.extend) with @discourseComputed decorator
    // is not included here because the test environment doesn't have the Babel transformer
    // needed to parse decorator syntax on object properties. This functionality should be
    // tested manually in the actual Discourse codebase where the transformer is available.
  ],
});
