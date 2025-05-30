export default {
  meta: {
    type: "problem",
    docs: {
      description: "Do not use themeSetting or themeI18n helpers.",
    },
    fixable: "code",
    schema: [], // no options
  },

  create(context) {
    return {
      ImportDeclaration(node) {
        const modulePath = node.source.value.toLowerCase();
        const moduleScope = context.sourceCode.scopeManager.scopes.find(
          (s) => s.type === "module"
        );

        if (modulePath === "discourse/helpers/theme-setting") {
          context.report({
            node,
            message: `Importing themeSetting is not allowed.`,
            fix(fixer) {
              const fixes = [fixer.remove(node)];

              const importName = node.specifiers[0].local.name;
              const themeSetting = moduleScope.variables.find(
                (v) => v.name === importName
              );
              themeSetting.references.forEach((ref) => {
                const expression = ref.identifier.parent.parent;
                const param = expression?.params[0];

                if (expression?.type === "GlimmerMustacheStatement") {
                  fixes.push(
                    fixer.replaceText(expression, `{{settings.${param.value}}}`)
                  );
                } else if (expression?.type === "GlimmerSubExpression") {
                  fixes.push(
                    fixer.replaceText(expression, `settings.${param.value}`)
                  );
                }
              });

              return fixes;
            },
          });
        } else if (modulePath === "discourse/helpers/theme-i18n") {
          context.report({
            node,
            message: `Importing themeI18n is not allowed.`,
            fix(fixer) {
              const fixes = [];

              const i18nImport = moduleScope.variables.find(
                (v) => v.name === "i18n"
              );
              if (i18nImport) {
                fixes.push(fixer.remove(node));
              } else {
                fixes.push(
                  fixer.replaceText(
                    node,
                    `import { i18n } from "discourse-i18n";`
                  )
                );
              }

              const importName = node.specifiers[0].local.name;
              const themeI18n = moduleScope.variables.find(
                (v) => v.name === importName
              );
              themeI18n.references.forEach((ref) => {
                const expression = ref.identifier.parent.parent;
                if (
                  ["GlimmerMustacheStatement", "GlimmerSubExpression"].includes(
                    expression?.type
                  )
                ) {
                  const param = expression.params[0];
                  if (param) {
                    fixes.push(fixer.replaceText(ref.identifier, "i18n"));
                    fixes.push(fixer.insertTextBefore(param, "(themePrefix "));
                    fixes.push(fixer.insertTextAfter(param, ")"));
                  }
                }
              });

              return fixes;
            },
          });
        }
      },
    };
  },
};
