import { parse as babelParse, parseExpression } from "@babel/parser";
import * as prettierPluginBabel from "prettier/plugins/babel";
import toFastProperties from "to-fast-properties";
import { VISITOR_KEYS as babelVisitorKeys } from "@babel/types";
import { visitorKeys as tsVisitorKeys } from "@typescript-eslint/visitor-keys";
import flowVisitorKeys from "hermes-parser/dist/generated/ESTreeVisitorKeys.js";

function getSourceType(options) {
  let { filepath } = options;
  if (!filepath) {
    return;
  }
  filepath = filepath.toLowerCase();

  if (filepath.endsWith(".cjs")) {
    return "script";
  }

  if (filepath.endsWith(".mjs")) {
    return "module";
  }
}

function tryCombinations(combinations) {
  const errors = [];
  for (const fn of combinations) {
    try {
      return fn();
    } catch (error) {
      errors.push(error);
    }
  }

  // TODO: Use `AggregateError` when we drop Node.js v14
  // throw new AggregateError(errors, "All combinations failed");
  throw Object.assign(new Error("All combinations failed"), { errors });
}

function createError(message, options) {
  // TODO: Use `Error.prototype.cause` when we drop support for Node.js<18.7.0

  // Construct an error similar to the ones thrown by Babel.
  const error = new SyntaxError(
    message +
      " (" +
      options.loc.start.line +
      ":" +
      options.loc.start.column +
      ")",
  );

  return Object.assign(error, options);
}

function createBabelParseError(error) {
  // babel error prints (line:column) with cols that are zero indexed
  // so we need our custom error
  const { message, loc } = error;

  return createError(message.replace(/ \(.*\)$/, ""), {
    loc: {
      start: {
        line: loc ? loc.line : 0,
        column: loc ? loc.column + 1 : 0,
      },
    },
    cause: error,
  });
}

function wrapBabelExpression(expression, options) {
  const { type = "JsExpressionRoot", rootMarker, text } = options;

  const { tokens, comments } = expression;
  delete expression.tokens;
  delete expression.comments;

  return {
    tokens,
    comments,
    type,
    node: expression,
    range: [0, text.length],
    rootMarker,
  };
}

const allowedMessageCodes = new Set([
  "StrictNumericEscape",
  "StrictWith",
  "StrictOctalLiteral",
  "StrictDelete",
  "StrictEvalArguments",
  "StrictEvalArgumentsBinding",
  "StrictFunction",

  "EmptyTypeArguments",
  "EmptyTypeParameters",
  "ConstructorHasTypeParameters",

  "UnsupportedParameterPropertyKind",

  "MixedLabeledAndUnlabeledElements",

  "DuplicateAccessibilityModifier",

  "DecoratorExportClass",
  "ParamDupe",
  "InvalidDecimal",
  "RestTrailingComma",
  "UnsupportedParameterDecorator",
  "UnterminatedJsxContent",
  "UnexpectedReservedWord",
  "ModuleAttributesWithDuplicateKeys",
  "LineTerminatorBeforeArrow",
  "InvalidEscapeSequenceTemplate",
  "NonAbstractClassHasAbstractMethod",
  "OptionalTypeBeforeRequired",
  "PatternIsOptional",
  "OptionalBindingPattern",
  "DeclareClassFieldHasInitializer",
  "TypeImportCannotSpecifyDefaultAndNamed",
  "DeclareFunctionHasImplementation",
  "ConstructorClassField",

  "VarRedeclaration",
  "InvalidPrivateFieldResolution",
  "DuplicateExport",

  // NOTE: this is restored from prettier 2
  "UnsupportedPropertyDecorator",
]);

function parseWithOptions(parse, text, options) {
  const ast = parse(text, options);
  const error = ast.errors.find(
    (error) => !allowedMessageCodes.has(error.reasonCode),
  );
  if (error) {
    throw error;
  }
  return ast;
}

function createGetVisitorKeys(visitorKeys, typeProperty = "type") {
  toFastProperties(visitorKeys);

  function getVisitorKeys(node) {
    const type = node[typeProperty];

    /* c8 ignore next 5 */
    // eslint-disable-next-line no-undef
    if (process.env.NODE_ENV !== "production" && type === undefined) {
      throw new Error(
        `Can't get node type, you must pass the wrong typeProperty '${typeProperty}'`,
      );
    }

    const keys = visitorKeys[type];
    /* c8 ignore next 5 */
    if (!Array.isArray(keys)) {
      throw Object.assign(new Error(`Missing visitor keys for '${type}'.`), {
        node,
      });
    }

    return keys;
  }

  return getVisitorKeys;
}

function unionVisitorKeys(all) {
  const result = {};

  for (const [type, keys] of all.flatMap((keys) => Object.entries(keys))) {
    result[type] = [...new Set([...(result[type] ?? []), ...keys])];
  }

  return result;
}

const additionalVisitorKeys = {
  // Prettier
  JsExpressionRoot: ["node"],
  JsonRoot: ["node"],

  // TypeScript
  TSJSDocAllType: [],
  TSJSDocUnknownType: [],
  TSJSDocNullableType: ["typeAnnotation"],
  TSJSDocNonNullableType: ["typeAnnotation"],
  // `@typescript-eslint/typescript-estree` v6 renamed `typeParameters` to `typeArguments`
  // Remove those when babel update AST
  JSXOpeningElement: ["typeParameters"],
  TSClassImplements: ["typeParameters"],
  TSInterfaceHeritage: ["typeParameters"],

  // Flow, missed in `flowVisitorKeys`
  ClassPrivateProperty: ["variance"],
  ClassProperty: ["variance"],
  NeverTypeAnnotation: [],
  TupleTypeAnnotation: ["elementTypes"],
  TypePredicate: ["asserts"],
  UndefinedTypeAnnotation: [],
  UnknownTypeAnnotation: [],
  AsExpression: ["expression", "typeAnnotation"],
  AsConstExpression: ["expression"],
  SatisfiesExpression: ["expression", "typeAnnotation"],
  TypeofTypeAnnotation: ["argument", "typeArguments"],
};

const excludeKeys = {
  // From `tsVisitorKeys`
  MethodDefinition: ["typeParameters"],
  TSPropertySignature: ["initializer"],

  // From `flowVisitorKeys`
  ArrowFunctionExpression: ["id"],
  DeclareOpaqueType: ["impltype"],
  FunctionExpression: ["predicate"],
  // Flow don't use it, but `typescript-eslint` v6 switched to `typeArguments`
  // JSXOpeningElement: ["typeArguments"],
  // TODO: Remove `types` when babel changes AST of `TupleTypeAnnotation`
  // Flow parser changed `.types` to `.elementTypes` https://github.com/facebook/flow/commit/5b60e6a81dc277dfab2e88fa3737a4dc9aafdcab
  // TupleTypeAnnotation: ["types"],
  PropertyDefinition: ["tsModifiers"],

  // From `babelVisitorKeys`
  DeclareInterface: ["mixins", "implements"],
  InterfaceDeclaration: ["mixins", "implements"],
};


const visitorKeys = Object.fromEntries(
  Object.entries(
    unionVisitorKeys([
      babelVisitorKeys,
      tsVisitorKeys,
      flowVisitorKeys,
      additionalVisitorKeys,
    ]),
  ).map(([type, keys]) => [
    type,
    excludeKeys[type]
      ? keys.filter((key) => !excludeKeys[type].includes(key))
      : keys,
  ]),
);


const getVisitorKeys = createGetVisitorKeys(visitorKeys);

function visitNode(node, fn) {
  if (!(node !== null && typeof node === "object")) {
    return node;
  }

  if (Array.isArray(node)) {
    // As of Node.js 16 using raw for loop over Array.entries provides a
    // measurable difference in performance. Array.entries returns an iterator
    // of arrays.
    for (let i = 0; i < node.length; i++) {
      node[i] = visitNode(node[i], fn);
    }
    return node;
  }

  const keys = getVisitorKeys(node);
  for (let i = 0; i < keys.length; i++) {
    node[keys[i]] = visitNode(node[keys[i]], fn);
  }

  return fn(node) || node;
}

function createTypeCheckFunction(types) {
  types = new Set(types);
  return (node) => types.has(node?.type);
}

const isBlockComment = createTypeCheckFunction([
  "Block",
  "CommentBlock",
  // `meriyah`
  "MultiLine",
]);

function isTypeCastComment(comment) {
  return (
    isBlockComment(comment) &&
    comment.value[0] === "*" &&
    // TypeScript expects the type to be enclosed in curly brackets, however
    // Closure Compiler accepts types in parens and even without any delimiters at all.
    // That's why we just search for "@type" and "@satisfies".
    /@(?:type|satisfies)\b/.test(comment.value)
  );
}

function isNonEmptyArray(object) {
  return Array.isArray(object) && object.length > 0;
}

function locStart(node) {
  const start = node.range ? node.range[0] : node.start;

  // Handle nodes with decorators. They should start at the first decorator
  const decorators = node.declaration?.decorators ?? node.decorators;
  if (isNonEmptyArray(decorators)) {
    return Math.min(locStart(decorators[0]), start);
  }

  return start;
}

function locEnd(node) {
  return node.range ? node.range[1] : node.end;
}

function isUnbalancedLogicalTree(node) {
  return (
    node.type === "LogicalExpression" &&
    node.right.type === "LogicalExpression" &&
    node.operator === node.right.operator
  );
}

function rebalanceLogicalTree(node) {
  if (!isUnbalancedLogicalTree(node)) {
    return node;
  }

  return rebalanceLogicalTree({
    type: "LogicalExpression",
    operator: node.operator,
    left: rebalanceLogicalTree({
      type: "LogicalExpression",
      operator: node.operator,
      left: node.left,
      right: node.right.left,
      range: [locStart(node.left), locEnd(node.right.left)],
    }),
    right: node.right.right,
    range: [locStart(node), locEnd(node)],
  });
}

function isIndentableBlockComment(comment) {
  // If the comment has multiple lines and every line starts with a star
  // we can fix the indentation of each line. The stars in the `/*` and
  // `*/` delimiters are not included in the comment value, so add them
  // back first.
  const lines = `*${comment.value}*`.split("\n");
  return lines.length > 1 && lines.every((line) => line.trimStart()[0] === "*");
}

function postprocess(ast, options) {
  const { parser, text } = options;

  // `InterpreterDirective` from babel parser
  // Other parsers parse it as comment, babel treat it as comment too
  // https://github.com/babel/babel/issues/15116
  if (ast.type === "File" && ast.program.interpreter) {
    const {
      program: { interpreter },
      comments,
    } = ast;
    delete ast.program.interpreter;
    comments.unshift(interpreter);
  }

  // Keep Babel's non-standard ParenthesizedExpression nodes only if they have Closure-style type cast comments.
  if (parser === "babel") {
    const startOffsetsOfTypeCastedNodes = new Set();

    // Comments might be attached not directly to ParenthesizedExpression but to its ancestor.
    // E.g.: /** @type {Foo} */ (foo).bar();
    // Let's use the fact that those ancestors and ParenthesizedExpression have the same start offset.

    ast = visitNode(ast, (node) => {
      if (node.leadingComments?.some(isTypeCastComment)) {
        startOffsetsOfTypeCastedNodes.add(locStart(node));
      }
    });

    ast = visitNode(ast, (node) => {
      if (node.type === "ParenthesizedExpression") {
        const { expression } = node;

        // Align range with `flow`
        if (expression.type === "TypeCastExpression") {
          expression.range = node.range;
          return expression;
        }

        const start = locStart(node);
        if (!startOffsetsOfTypeCastedNodes.has(start)) {
          expression.extra = { ...expression.extra, parenthesized: true };
          return expression;
        }
      }
    });
  }

  ast = visitNode(ast, (node) => {
    switch (node.type) {
      case "LogicalExpression":
        // We remove unneeded parens around same-operator LogicalExpressions
        if (isUnbalancedLogicalTree(node)) {
          return rebalanceLogicalTree(node);
        }
        break;

      // fix unexpected locEnd caused by --no-semi style
      case "VariableDeclaration": {
        const lastDeclaration = node.declarations.at(-1);
        if (lastDeclaration?.init) {
          overrideLocEnd(node, lastDeclaration);
        }
        break;
      }
      // remove redundant TypeScript nodes
      case "TSParenthesizedType":
        return node.typeAnnotation;

      case "TSTypeParameter":
        // babel-ts
        if (typeof node.name === "string") {
          const start = locStart(node);
          node.name = {
            type: "Identifier",
            name: node.name,
            range: [start, start + node.name.length],
          };
        }
        break;

      // For hack-style pipeline
      case "TopicReference":
        ast.extra = { ...ast.extra, __isUsingHackPipeline: true };
        break;

      // TODO: Remove this when https://github.com/meriyah/meriyah/issues/200 get fixed
      case "ExportAllDeclaration": {
        const { exported } = node;
        if (parser === "meriyah" && exported?.type === "Identifier") {
          const raw = text.slice(locStart(exported), locEnd(exported));
          if (raw.startsWith('"') || raw.startsWith("'")) {
            node.exported = {
              ...node.exported,
              type: "Literal",
              value: node.exported.name,
              raw,
            };
          }
        }
        break;
      }
      // In Flow parser, it doesn't generate union/intersection types for single type
      case "TSUnionType":
      case "TSIntersectionType":
        if (node.types.length === 1) {
          return node.types[0];
        }
        break;
    }
  });

  if (isNonEmptyArray(ast.comments)) {
    let followingComment = ast.comments.at(-1);
    for (let i = ast.comments.length - 2; i >= 0; i--) {
      const comment = ast.comments[i];
      if (
        locEnd(comment) === locStart(followingComment) &&
        isBlockComment(comment) &&
        isBlockComment(followingComment) &&
        isIndentableBlockComment(comment) &&
        isIndentableBlockComment(followingComment)
      ) {
        ast.comments.splice(i + 1, 1);
        comment.value += "*//*" + followingComment.value;
        comment.range = [locStart(comment), locEnd(followingComment)];
      }
      followingComment = comment;
    }
  }

  // In `typescript`/`espree`/`flow`, `Program` doesn't count whitespace and comments
  // See https://github.com/eslint/espree/issues/488
  if (ast.type === "Program") {
    ast.range = [0, text.length];
  }
  return ast;

  /**
   * - `toOverrideNode` must be the last thing in `toBeOverriddenNode`
   * - do nothing if there's a semicolon on `toOverrideNode.end` (no need to fix)
   */
  function overrideLocEnd(toBeOverriddenNode, toOverrideNode) {
    if (text[locEnd(toOverrideNode)] === ";") {
      return;
    }
    toBeOverriddenNode.range = [
      locStart(toBeOverriddenNode),
      locEnd(toOverrideNode),
    ];
  }
}


function createParse({ isExpression = false, optionsCombinations }) {
  return (text, options = {}) => {
    let combinations = optionsCombinations;
    const sourceType = options.__babelSourceType ?? getSourceType(options);
    if (sourceType === "script") {
      combinations = combinations.map((options) => ({
        ...options,
        sourceType: "script",
      }));
    }

    const parseFunction = isExpression ? parseExpression : babelParse;

    let ast;
    try {
      ast = tryCombinations(
        combinations.map(
          (options) => () => parseWithOptions(parseFunction, text, options),
        ),
      );
    } catch (/** @type {any} */ { errors: [error] }) {
      throw createBabelParseError(error);
    }

    if (isExpression) {
      ast = wrapBabelExpression(ast, { text, rootMarker: options.rootMarker });
    }

    return postprocess(ast, { parser: "babel", text });
  };
}

const parseOptions = {
  sourceType: "module",
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  allowNewTargetOutsideFunction: true,
  allowSuperOutsideMethod: true,
  allowUndeclaredExports: true,
  errorRecovery: true,
  createParenthesizedExpressions: true,
  createImportExpressions: true,
  plugins: [
    // When adding a plugin, please add a test in `tests/format/js/babel-plugins`,
    // To remove plugins, remove it here and run `yarn test tests/format/js/babel-plugins` to verify
    "doExpressions",
    "exportDefaultFrom",
    "functionBind",
    "functionSent",
    "throwExpressions",
    "partialApplication",
    "decorators",
    "decimal",
    "moduleBlocks",
    "asyncDoExpressions",
    "regexpUnicodeSets",
    "destructuringPrivate",
    "decoratorAutoAccessors",
    "importReflection",
    "explicitResourceManagement",
    ["importAttributes", { deprecatedAssertSyntax: true }],
    "sourcePhaseImports",
    "deferredImportEvaluation",
    ["optionalChainingAssign", { version: "2023-07" }],
  ],
  tokens: true,
  ranges: true,
};

const appendPlugins = (plugins, options = parseOptions) => ({
  ...options,
  plugins: [...options.plugins, ...plugins],
});

const babelParserOptionsCombinations = [appendPlugins(["jsx"])];
const parse = createParse({
  optionsCombinations: babelParserOptionsCombinations
});

const customBabelPlugin = {
  parsers: {
    "custom-babel-parser": {
      ...prettierPluginBabel.parsers.babel,
      parse,
    },
  },
};

export default customBabelPlugin;
