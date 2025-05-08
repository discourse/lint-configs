import stylelint from "stylelint";

const ruleName = "discourse/no-mixed-declarations";
const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: "Do not mix declarations with nested rules or directives.",
});

const ruleFunction = (primaryOption) => {
  return (root, result) => {
    if (!primaryOption) {
      return;
    }

    root.walkRules((rule) => {
      let foundNested = false;

      // Check the order of nodes
      rule.each((node) => {
        if (node.type === "rule" || node.type === "atrule") {
          foundNested = true; // Nested rule or directive found
        } else if (node.type === "decl" && foundNested) {
          // Declaration found after a nested rule or directive
          stylelint.utils.report({
            message: messages.rejected,
            node: rule,
            result,
            ruleName,
            fix: () => {
              // Reorder: Move all declarations to the top of the block
              const declarations = [];
              const others = [];

              rule.each((child) => {
                if (child.type === "decl") {
                  declarations.push(child); // Keep the original order
                } else {
                  others.push(child);
                }
              });

              // Remove all nodes and re-add them in the correct order
              rule.removeAll();
              declarations.forEach((decl) => rule.append(decl));
              others.forEach((other) => rule.append(other));
            },
          });

          return false; // Stop further checks for this rule
        }
      });
    });
  };
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = {
  fixable: true,
};

export default stylelint.createPlugin(ruleName, ruleFunction);
