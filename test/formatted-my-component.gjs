import or from "truth-helpers/helpers/or";
import { inject as service } from "@ember/service";
import Component from "@glimmer/component";

export default class MyComponent extends Component {
  <template>
    {{#if (or @foo settings.bar)}}
      hey
      {{this.currentUser.username}}!
    {{/if}}
  </template>

  @service currentUser;
}
