import EmberObject from "@ember/object";

export default EmberObject.extends({
  @computed("test")
  get prop() {
    return this.test + 1;
  },
});
