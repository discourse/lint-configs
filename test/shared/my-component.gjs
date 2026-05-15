import { or } from "truth-helpers";
import { service } from "@ember/service";
import Component from "@glimmer/component";
import didInsert from "@ember/render-modifiers/modifiers/did-insert";
import DButton from "discourse/components/d-button";

export default class MyComponent extends Component{
   @service currentUser;

  loadData() {}

  <template>
    {{#if (or @foo settings.bar)}}
       <DButton @class='boop' {{didInsert this.loadData}}>
        hey {{this.currentUser.username}}!
      </DButton>
    {{/if}}
  </template>
}
