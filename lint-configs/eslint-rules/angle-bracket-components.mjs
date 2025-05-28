import { fixImport } from "./utils/fix-import.mjs";

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

        if (!importedModuleName.includes("/components/")) {
          return;
        }

        context.report({
          node,
          message: `Use angle bracket syntax for components.`,
          fix(fixer) {
            return [fixer.replaceText(node, `<${variableName} />`)];
          },
        });
      },
    };
  },
};
