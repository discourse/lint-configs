import or from "truth-helpers/helpers/or";
import { inject as service } from "@ember/service";
import Component from "@glimmer/component";

export default class MyComponent extends Component {
  @service currentUser;

  <template>
    {{#if (or @foo settings.bar)}}
      <span class="boop">
        hey
        {{this.currentUser.username}}!
      </span>
    {{/if}}
    {{log "oops"}}
  </template>
}
