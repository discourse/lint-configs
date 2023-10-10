import { readFileSync } from "fs";
import { execSync } from "child_process";

const expected = readFileSync("formatted-my-component.gjs", "utf8");
const actual = execSync("yarn --silent prettier my-component.gjs").toString();

if (expected === actual) {
  console.log("ok");
} else {
  console.error(`failed\n\nexpected:\n${expected}\nactual:\n${actual}`);
}
