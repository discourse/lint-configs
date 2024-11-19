import or from "truth-helpers/helpers/or";
import { service } from "@ember/service";
import Component from "@glimmer/component";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";


export default class MyComponent extends Component{
   @service currentUser;

  loadData() {}

  <template>
    {{#if (or @foo settings.bar)}}
       <span class='boop' {{didInsert this.loadData}}>
        hey {{this.currentUser.username}}!
      </span >
    {{/if}}
    {{log "oops"}}
  </template>
}
