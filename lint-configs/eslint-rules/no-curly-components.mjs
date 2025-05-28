import path from "path";

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Use i18n(...) instead of 'I18n.t(...)'.",
    },
    fixable: "code",
    schema: [], // no options
  },

  create(context) {
    // console.log(context.sourceCode);
    // const sourceCode = context.sourceCode ?? context.getSourceCode();
    // let alreadyFixedImport = false;

    return {
      GlimmerMustacheStatement(node) {
        const isSimplePath =
          node.path.type === "GlimmerPathExpression" &&
          node.path.head.type === "VarHead" &&
          !node.tail?.length;

        if (!isSimplePath) {
          return;
        }

        const variableName = node.path.head.name;

        const moduleScope = context.sourceCode.scopeManager.scopes.find(
          (s) => s.type === "module"
        );
        const variable = moduleScope.variables.find(
          (v) => v.name === variableName
        );

        if (!variable) {
          return;
        }

        const importBinding = variable.defs.find(
          (d) =>
            d.type === "ImportBinding" &&
            d.node.type === "ImportDefaultSpecifier"
        );

        if (!importBinding) {
          return;
        }

        const importedModuleName = importBinding.node.parent.source.value;

        // This is not perfect, but it should catch 99% of components
        let resolvedModuleName = importedModuleName;
        if (importedModuleName.startsWith(".")) {
          const cwd = context.cwd;
          const sourceDirectoryFromCwd = path.dirname(
            path.relative(cwd, context.getFilename())
          );

          resolvedModuleName = path.join(
            sourceDirectoryFromCwd,
            importedModuleName
          );
        }

        if (!resolvedModuleName.includes("/components/")) {
          return;
        }

        context.report({
          node,
          message: `Use angle bracket syntax for components.`,
          fix(fixer) {
            const fixes = [];

            let argumentString = "";

            node.hash?.pairs.forEach(({ key, value }) => {
              let valueSource = context.sourceCode.text.slice(...value.range);
              valueSource = valueSource.replace(/^\(/, "").replace(/\)$/, "");
              argumentString += `@${key}={{${valueSource}}} `;
            });

            return [
              fixer.replaceText(node, `<${variableName} ${argumentString}/>`),
            ];
          },
        });
      },
    };
  },
};
