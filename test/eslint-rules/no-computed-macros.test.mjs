import EmberESLintParser from "ember-eslint-parser";
import { RuleTester } from "eslint";
import rule from "../../lint-configs/eslint-rules/no-computed-macros.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: EmberESLintParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      ecmaFeatures: {
        legacyDecorators: true,
        classFields: true,
      },
    },
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

ruleTester.run("no-computed-macros", rule, {
  valid: [
    {
      name: "native getter with @computed is fine",
      code: `import { computed } from "@ember/object";
class C {
  @computed("model.title")
  get title() {
    return this.model?.title;
  }
}`,
    },
    {
      name: "import from non-macro source is fine",
      code: `import { something } from "some-other-package";
class C {
  @something("foo") bar;
}`,
    },
    {
      name: "non-macro import from @ember/object/computed is fine",
      code: `import { computed } from "@ember/object";
class C {
  @computed("foo")
  get bar() {
    return this.foo;
  }
}`,
    },
  ],

  invalid: [
    // ---- alias (nested dep → @computed) ----
    {
      name: "@alias with nested path → @computed getter",
      code: `import { alias } from "@ember/object/computed";
class C {
  @alias("model.title") title;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("model.title")
  get title() {
    return this.model?.title;
  }
}`,
    },

    // ---- alias (local dep → @dependentKeyCompat + @tracked) ----
    {
      name: "@alias with local path → @dependentKeyCompat + @tracked",
      code: `import { alias } from "@ember/object/computed";
class C {
  @alias("name") myName;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked name;
  @dependentKeyCompat
  get myName() {
    return this.name;
  }
}`,
    },

    // ---- readOnly (nested) ----
    {
      name: "@readOnly with nested path",
      code: `import { readOnly } from "@ember/object/computed";
class C {
  @readOnly("model.items") modelItems;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("model.items")
  get modelItems() {
    return this.model?.items;
  }
}`,
    },

    // ---- not (local) ----
    {
      name: "@not with local dep",
      code: `import { not } from "@ember/object/computed";
class C {
  @not("isHidden") isVisible;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked isHidden;
  @dependentKeyCompat
  get isVisible() {
    return !this.isHidden;
  }
}`,
    },

    // ---- bool ----
    {
      name: "@bool with local dep",
      code: `import { bool } from "@ember/object/computed";
class C {
  @bool("count") hasItems;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked count;
  @dependentKeyCompat
  get hasItems() {
    return !!this.count;
  }
}`,
    },

    // ---- and (local) ----
    {
      name: "@and with local deps",
      code: `import { and } from "@ember/object/computed";
class C {
  @and("pinned", "readLastPost") canClearPin;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked pinned;
  @tracked readLastPost;
  @dependentKeyCompat
  get canClearPin() {
    return this.pinned && this.readLastPost;
  }
}`,
    },

    // ---- or (nested) ----
    {
      name: "@or with nested deps",
      code: `import { or } from "@ember/object/computed";
class C {
  @or("details.can_edit", "details.can_edit_tags") canEditTags;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("details.can_edit", "details.can_edit_tags")
  get canEditTags() {
    return this.details?.can_edit || this.details?.can_edit_tags;
  }
}`,
    },

    // ---- equal ----
    {
      name: "@equal with local dep",
      code: `import { equal } from "@ember/object/computed";
class C {
  @equal("trust_level", 0) isBasic;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked trust_level;
  @dependentKeyCompat
  get isBasic() {
    return this.trust_level === 0;
  }
}`,
    },

    // ---- gt (nested) ----
    {
      name: "@gt with nested dep",
      code: `import { gt } from "@ember/object/computed";
class C {
  @gt("private_messages_stats.all", 0) hasPMs;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("private_messages_stats.all")
  get hasPMs() {
    return this.private_messages_stats?.all > 0;
  }
}`,
    },

    // ---- notEmpty ----
    {
      name: "@notEmpty with local dep (dep key uses .length)",
      code: `import { notEmpty } from "@ember/object/computed";
class C {
  @notEmpty("deleted_at") deleted;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { isEmpty } from "@ember/utils";
import { computed } from "@ember/object";
class C {
  @computed("deleted_at.length")
  get deleted() {
    return !isEmpty(this.deleted_at);
  }
}`,
    },

    // ---- empty ----
    {
      name: "@empty with local dep",
      code: `import { empty } from "@ember/object/computed";
class C {
  @empty("items") noItems;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { isEmpty } from "@ember/utils";
import { computed } from "@ember/object";
class C {
  @computed("items.length")
  get noItems() {
    return isEmpty(this.items);
  }
}`,
    },

    // ---- none ----
    {
      name: "@none with local dep",
      code: `import { none } from "@ember/object/computed";
class C {
  @none("id") isNew;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked id;
  @dependentKeyCompat
  get isNew() {
    return this.id == null;
  }
}`,
    },

    // ---- match (nested) ----
    {
      name: "@match with nested dep",
      code: `import { match } from "@ember/object/computed";
class C {
  @match("model.url", /^https?:\\/\\//) isHttp;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("model.url")
  get isHttp() {
    return /^https?:\\/\\//.test(this.model?.url);
  }
}`,
    },

    // ---- mapBy ----
    {
      name: "@mapBy always uses @computed (dep has @each)",
      code: `import { mapBy } from "@ember/object/computed";
class C {
  @mapBy("themes", "name") themeNames;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("themes.@each.name")
  get themeNames() {
    return this.themes?.map((item) => item.name) ?? [];
  }
}`,
    },

    // ---- filterBy without value ----
    {
      name: "@filterBy without value arg",
      code: `import { filterBy } from "@ember/object/computed";
class C {
  @filterBy("groups", "has_messages") groupsWithMessages;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("groups.@each.has_messages")
  get groupsWithMessages() {
    return this.groups?.filter((item) => item.has_messages) ?? [];
  }
}`,
    },

    // ---- filterBy with value ----
    {
      name: "@filterBy with value arg",
      code: `import { filterBy } from "@ember/object/computed";
class C {
  @filterBy("model", "is_favorite", true) favoriteBadges;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("model.@each.is_favorite")
  get favoriteBadges() {
    return this.model?.filter((item) => item.is_favorite === true) ?? [];
  }
}`,
    },

    // ---- sort ----
    {
      name: "@sort with two deps",
      code: `import { sort } from "@ember/object/computed";
class C {
  @sort("categories", "sortDef") sorted;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { compare } from "@ember/utils";
import { computed } from "@ember/object";
class C {
  @computed("categories.[]", "sortDef.[]")
  get sorted() {
    return [...(this.categories ?? [])].sort((a, b) => {
      for (const s of this.sortDef ?? []) {
        const [prop, dir = "asc"] = s.split(":");
        const result = compare(a[prop], b[prop]);
        if (result !== 0) {
          return dir === "desc" ? -result : result;
        }
      }
      return 0;
    });
  }
}`,
    },

    // ---- collect (local) ----
    {
      name: "@collect with local deps",
      code: `import { collect } from "@ember/object/computed";
class C {
  @collect("a", "b") items;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked a;
  @tracked b;
  @dependentKeyCompat
  get items() {
    return [this.a === undefined ? null : this.a, this.b === undefined ? null : this.b];
  }
}`,
    },

    // ---- uniq ----
    {
      name: "@uniq macro",
      code: `import { uniq } from "@ember/object/computed";
class C {
  @uniq("items") uniqueItems;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { uniqueItemsFromArray } from "discourse/lib/array-tools";
import { computed } from "@ember/object";
class C {
  @computed("items.[]")
  get uniqueItems() {
    return uniqueItemsFromArray(this.items ?? []);
  }
}`,
    },

    // ---- union ----
    {
      name: "@union macro with two arrays",
      code: `import { union } from "@ember/object/computed";
class C {
  @union("a", "b") combined;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { uniqueItemsFromArray } from "discourse/lib/array-tools";
import { computed } from "@ember/object";
class C {
  @computed("a.[]", "b.[]")
  get combined() {
    return uniqueItemsFromArray([...(this.a ?? []), ...(this.b ?? [])]);
  }
}`,
    },

    // ---- intersect ----
    {
      name: "@intersect macro",
      code: `import { intersect } from "@ember/object/computed";
class C {
  @intersect("a", "b") common;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("a.[]", "b.[]")
  get common() {
    return (this.b ?? []).filter((item) => (this.a ?? []).includes(item));
  }
}`,
    },

    // ---- setDiff ----
    {
      name: "@setDiff macro",
      code: `import { setDiff } from "@ember/object/computed";
class C {
  @setDiff("a", "b") diff;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("a.[]", "b.[]")
  get diff() {
    return (this.a ?? []).filter((item) => !(this.b ?? []).includes(item));
  }
}`,
    },

    // ---- sum ----
    {
      name: "@sum macro",
      code: `import { sum } from "@ember/object/computed";
class C {
  @sum("values") total;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("values.[]")
  get total() {
    return this.values?.reduce((s, v) => s + v, 0) ?? 0;
  }
}`,
    },

    // ---- filter (non-fixable) ----
    {
      name: "@filter with callback is not auto-fixable",
      code: `import { filter } from "@ember/object/computed";
class C {
  @filter("categories", function(c) { return !c.get("parentCategory"); }) parentCategories;
}`,
      errors: [
        { messageId: "replaceMacro" },
        { messageId: "cannotAutoFixComplex" },
      ],
    },

    // ---- discourse/lib/computed: propertyEqual (nested) ----
    {
      name: "@propertyEqual with nested deps",
      code: `import { propertyEqual } from "discourse/lib/computed";
class C {
  @propertyEqual("topic.details.created_by.id", "user_id") topicOwner;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { deepEqual } from "discourse/lib/object";
import { computed } from "@ember/object";
class C {
  @computed("topic.details.created_by.id", "user_id")
  get topicOwner() {
    return deepEqual(this.topic?.details?.created_by?.id, this.user_id);
  }
}`,
    },

    // ---- propertyNotEqual (local) ----
    {
      name: "@propertyNotEqual with local deps",
      code: `import { propertyNotEqual } from "discourse/lib/computed";
class C {
  @propertyNotEqual("originalTrustLevel", "trust_level") dirty;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { deepEqual } from "discourse/lib/object";
import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked originalTrustLevel;
  @tracked trust_level;
  @dependentKeyCompat
  get dirty() {
    return !deepEqual(this.originalTrustLevel, this.trust_level);
  }
}`,
    },

    // ---- setting ----
    {
      name: "@setting always produces @computed (nested: siteSettings.x)",
      code: `import { setting } from "discourse/lib/computed";
class C {
  @setting("title") siteTitle;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("siteSettings.title")
  get siteTitle() {
    return this.siteSettings.title;
  }
}`,
    },

    // ---- fmt (local) ----
    {
      name: "@fmt with local dep",
      code: `import { fmt } from "discourse/lib/computed";
class C {
  @fmt("url", "%@/print") printUrl;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked url;
  @dependentKeyCompat
  get printUrl() {
    return \`\${this.url}/print\`;
  }
}`,
    },

    // ---- url (local) ----
    {
      name: "@url with local deps",
      code: `import { url } from "discourse/lib/computed";
class C {
  @url("id", "username_lower", "/admin/users/%@1/%@2") adminPath;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import getURL from "discourse/lib/get-url";
import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked id;
  @tracked username_lower;
  @dependentKeyCompat
  get adminPath() {
    return getURL(\`/admin/users/\${this.id}/\${this.username_lower}\`);
  }
}`,
    },

    // ---- i18n ----
    {
      name: "@i18n with local dep",
      code: `import { i18n } from "discourse/lib/computed";
class C {
  @i18n("action_type", "user_action_groups.%@") description;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { i18n } from "discourse-i18n";
import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked action_type;
  @dependentKeyCompat
  get description() {
    return i18n(\`user_action_groups.\${this.action_type}\`);
  }
}`,
    },
    {
      name: "@computedI18n alias",
      code: `import { computedI18n } from "discourse/lib/computed";
class C {
  @computedI18n("action_type", "user_action_groups.%@") description;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { i18n } from "discourse-i18n";
import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked action_type;
  @dependentKeyCompat
  get description() {
    return i18n(\`user_action_groups.\${this.action_type}\`);
  }
}`,
    },

    // ---- htmlSafe ----
    {
      name: "@htmlSafe with local dep",
      code: `import { htmlSafe } from "discourse/lib/computed";
class C {
  @htmlSafe("bio") safeBio;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { htmlSafe } from "@ember/template";
import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked bio;
  @dependentKeyCompat
  get safeBio() {
    return htmlSafe(this.bio);
  }
}`,
    },

    // ---- endWith ----
    {
      name: "@endWith with local dep",
      code: `import { endWith } from "discourse/lib/computed";
class C {
  @endWith("name", ".js") isJsFile;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked name;
  @dependentKeyCompat
  get isJsFile() {
    return this.name?.endsWith(".js");
  }
}`,
    },

    // ---- existing @tracked dep should not be duplicated ----
    {
      name: "does not add @tracked for already tracked deps",
      code: `import { tracked } from "@glimmer/tracking";
import { not } from "@ember/object/computed";
class C {
  @tracked isHidden;
  @not("isHidden") isVisible;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked isHidden;
  @dependentKeyCompat
  get isVisible() {
    return !this.isHidden;
  }
}`,
    },
    {
      name: "adds @tracked to existing member without it",
      code: `import { alias } from "@ember/object/computed";
class C {
  headerLang = null;
  @alias("headerLang") lang;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked headerLang = null;
  @dependentKeyCompat
  get lang() {
    return this.headerLang;
  }
}`,
    },
    {
      name: "two macros sharing same dep do not duplicate @tracked",
      code: `import { i18n } from "discourse/lib/computed";
class C {
  @i18n("name", "group.%@.title") title;
  @i18n("name", "group.%@.help") help;
}`,
      errors: [
        { messageId: "replaceMacro" },
        { messageId: "replaceMacro" },
        { messageId: "replaceMacro" },
      ],
      output: `import { i18n } from "discourse-i18n";
import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked name;
  @dependentKeyCompat
  get title() {
    return i18n(\`group.\${this.name}.title\`);
  }
  @dependentKeyCompat
  get help() {
    return i18n(\`group.\${this.name}.help\`);
  }
}`,
    },

    {
      name: "does not add @tracked when dep is an existing getter",
      code: `import { not } from "@ember/object/computed";
class C {
  @not("isHidden") isExpanded;
  get isHidden() {
    return false;
  }
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @dependentKeyCompat
  get isExpanded() {
    return !this.isHidden;
  }
  get isHidden() {
    return false;
  }
}`,
    },
    {
      name: "does not add @tracked when dep is another macro being converted",
      code: `import { alias, not } from "@ember/object/computed";
class C {
  @not("enabled") disabled;
  @alias("disabled") isDisabled;
}`,
      errors: [
        { messageId: "replaceMacro" },
        { messageId: "replaceMacro" },
        { messageId: "replaceMacro" },
        { messageId: "replaceMacro" },
      ],
      output: `import { tracked } from "@glimmer/tracking";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @tracked enabled;
  @dependentKeyCompat
  get disabled() {
    return !this.enabled;
  }
  @dependentKeyCompat
  get isDisabled() {
    return this.disabled;
  }
}`,
    },

    // ---- import alias ----
    {
      name: "handles import aliases",
      code: `import { alias as emberAlias } from "@ember/object/computed";
class C {
  @emberAlias("model.title") title;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("model.title")
  get title() {
    return this.model?.title;
  }
}`,
    },

    // ---- mixed local/nested deps → @computed wins ----
    {
      name: "mixed local and nested deps → uses @computed",
      code: `import { and } from "@ember/object/computed";
class C {
  @and("pinned", "category.isUncategorizedCategory") isPinnedUncategorized;
}`,
      errors: [{ messageId: "replaceMacro" }, { messageId: "replaceMacro" }],
      output: `import { computed } from "@ember/object";
class C {
  @computed("pinned", "category.isUncategorizedCategory")
  get isPinnedUncategorized() {
    return this.pinned && this.category?.isUncategorizedCategory;
  }
}`,
    },

    // ---- classic .extend() → report only ----
    {
      name: "classic .extend() class reports without fix",
      code: `import { alias } from "@ember/object/computed";
const Foo = EmberObject.extend({
  title: alias("model.title"),
});`,
      errors: [
        { messageId: "replaceMacro" },
        { messageId: "cannotAutoFixClassic" },
      ],
    },

    // ---- non-literal args → report only ----
    {
      name: "non-literal args are not auto-fixable",
      code: `import { alias } from "@ember/object/computed";
const key = "model.title";
class C {
  @alias(key) title;
}`,
      errors: [
        { messageId: "replaceMacro" },
        { messageId: "cannotAutoFixDynamic" },
      ],
    },

    // ---- dual source: macros from both @ember/object/computed AND discourse/lib/computed ----
    {
      name: "dual source does not duplicate shared imports",
      code: `import { notEmpty } from "@ember/object/computed";
import { propertyNotEqual } from "discourse/lib/computed";
class C {
  @notEmpty("items") hasItems;
  @propertyNotEqual("a", "b") isDifferent;
}`,
      errors: [
        { messageId: "replaceMacro" },
        { messageId: "replaceMacro" },
        { messageId: "replaceMacro" },
        { messageId: "replaceMacro" },
      ],
      output: `import { isEmpty } from "@ember/utils";
import { deepEqual } from "discourse/lib/object";
import { tracked } from "@glimmer/tracking";
import { computed } from "@ember/object";
import { dependentKeyCompat } from "@ember/object/compat";
class C {
  @computed("items.length")
  get hasItems() {
    return !isEmpty(this.items);
  }
  @tracked a;
  @tracked b;
  @dependentKeyCompat
  get isDifferent() {
    return !deepEqual(this.a, this.b);
  }
}`,
    },
  ],
});
