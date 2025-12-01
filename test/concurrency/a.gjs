import Component from "@glimmer/component";

export default class A extends Component {
  a = 1;

  <template>{{this.a}}</template>
}
