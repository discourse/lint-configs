/**
 * @fileoverview Analysis helpers for the `no-computed-macros` ESLint rule.
 *
 * Performs read-only AST traversal to detect usages of computed property macros
 * from `@ember/object/computed` and `discourse/lib/computed`, determines whether
 * each usage can be auto-fixed, and collects the information the fixer needs.
 */

import { isLocalKey, MACRO_TRANSFORMS } from "./macro-transforms.mjs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} MacroUsage
 * @property {string} macroName - The original macro name (e.g. "alias", "not")
 * @property {string} localName - The local identifier name (may differ due to aliases)
 * @property {import('./macro-transforms.mjs').MacroTransform} transform
 * @property {import('estree').Node} decoratorNode - The Decorator AST node
 * @property {import('estree').Node} propertyNode - The PropertyDefinition AST node
 * @property {string[]} literalArgs - Literal string/number argument values
 * @property {import('estree').Node[]} argNodes - Raw AST argument nodes
 * @property {string} propName - The decorated property name
 * @property {string[]} dependentKeys - Resolved dependent keys
 * @property {boolean} allLocal - Whether all dependent keys are local (no dots)
 * @property {boolean} canAutoFix
 * @property {string} [messageId] - Message ID when not auto-fixable
 * @property {Object} [reportData] - Data for error message interpolation
 * @property {string[]} [trackedDeps] - Local deps needing a NEW @tracked declaration (not existing members)
 * @property {import('estree').Node[]} [existingNodesToDecorate] - Existing PropertyDefinition nodes needing @tracked added
 */

/**
 * @typedef {Object} MacroAnalysisResult
 * @property {MacroUsage[]} usages - All detected macro usages
 * @property {Map<string, string>} importedMacros - Map from local name → macro name
 * @property {Map<string, import('estree').ImportDeclaration>} macroImportNodes - Import nodes by source
 */

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze the source AST for computed property macro usage.
 *
 * @param {import('eslint').SourceCode} sourceCode
 * @param {Map<string, {node: import('estree').ImportDeclaration, specifiers: Array}>} imports
 *   Result of `collectImports(sourceCode)`.
 * @returns {MacroAnalysisResult}
 */
export function analyzeMacroUsage(sourceCode, imports) {
  const importedMacros = collectMacroImports(imports);
  const macroImportNodes = collectMacroImportNodes(imports);
  const usages = [];

  if (importedMacros.size === 0) {
    return { usages, importedMacros, macroImportNodes };
  }

  for (const statement of sourceCode.ast.body) {
    walkNode(statement, (node) => {
      // Decorator usage on a PropertyDefinition in a native class
      if (node.type === "PropertyDefinition" && node.decorators) {
        analyzePropertyDefinition(node, importedMacros, usages, sourceCode);
      }
    });
  }

  // Post-process tracked deps:
  // 1. Remove deps that are themselves macro properties being converted to
  //    getters — adding @tracked to something that will become a getter is wrong.
  // 2. Deduplicate so each new @tracked declaration is emitted by one fixer only.
  excludeDepsBeingConverted(usages);
  deduplicateTrackedDeps(usages);

  return { usages, importedMacros, macroImportNodes };
}

// ---------------------------------------------------------------------------
// Import collection
// ---------------------------------------------------------------------------

/**
 * Scan the imports map for macro names from both target sources.
 * Returns a map from local identifier name → canonical macro name.
 *
 * @param {Map<string, {node: import('estree').ImportDeclaration, specifiers: Array}>} imports
 * @returns {Map<string, string>}
 */
function collectMacroImports(imports) {
  const result = new Map();

  for (const [, transform] of MACRO_TRANSFORMS) {
    const importInfo = imports.get(transform.source);
    if (!importInfo) {
      continue;
    }

    for (const spec of importInfo.specifiers) {
      if (spec.type !== "ImportSpecifier") {
        continue;
      }
      const importedName = spec.imported.name;
      if (MACRO_TRANSFORMS.has(importedName)) {
        result.set(spec.local.name, importedName);
      }
    }
  }

  return result;
}

/**
 * Collect the ImportDeclaration nodes for each macro source that has macros.
 *
 * @param {Map<string, {node: import('estree').ImportDeclaration, specifiers: Array}>} imports
 * @returns {Map<string, import('estree').ImportDeclaration>}
 */
function collectMacroImportNodes(imports) {
  const result = new Map();

  for (const source of ["@ember/object/computed", "discourse/lib/computed"]) {
    const importInfo = imports.get(source);
    if (importInfo) {
      result.set(source, importInfo.node);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// PropertyDefinition analysis (native class decorators)
// ---------------------------------------------------------------------------

/**
 * Analyze a PropertyDefinition node for macro decorator usage.
 *
 * @param {import('estree').Node} node - PropertyDefinition
 * @param {Map<string, string>} importedMacros
 * @param {MacroUsage[]} usages
 * @param {import('eslint').SourceCode} sourceCode
 */
function analyzePropertyDefinition(node, importedMacros, usages, sourceCode) {
  for (const decorator of node.decorators) {
    const expr = decorator.expression;

    // Must be a CallExpression — e.g. @alias("foo")
    if (expr.type !== "CallExpression") {
      continue;
    }

    const callee = expr.callee;
    if (callee.type !== "Identifier") {
      continue;
    }

    const macroName = importedMacros.get(callee.name);
    if (!macroName) {
      continue;
    }

    const transform = MACRO_TRANSFORMS.get(macroName);
    if (!transform) {
      continue;
    }

    const propName =
      node.key.type === "Identifier" ? node.key.name : String(node.key.value);

    const usage = buildUsage({
      macroName,
      localName: callee.name,
      transform,
      decoratorNode: decorator,
      propertyNode: node,
      argNodes: expr.arguments,
      propName,
      sourceCode,
    });

    usages.push(usage);
  }
}

// ---------------------------------------------------------------------------
// Usage builder
// ---------------------------------------------------------------------------

/**
 * Build a MacroUsage object from the gathered information, determining
 * fixability and computing dependent keys.
 *
 * @param {Object} params
 * @returns {MacroUsage}
 */
function buildUsage({
  macroName,
  localName,
  transform,
  decoratorNode,
  propertyNode,
  argNodes,
  propName,
  sourceCode,
}) {
  const base = {
    macroName,
    localName,
    transform,
    decoratorNode,
    propertyNode,
    argNodes,
    propName,
    sourceCode,
  };

  // Not auto-fixable by design (e.g. filter/map with callbacks)
  if (!transform.canAutoFix) {
    return {
      ...base,
      literalArgs: [],
      dependentKeys: [],
      allLocal: false,
      canAutoFix: false,
      messageId: "cannotAutoFixComplex",
      reportData: { name: macroName, reason: transform.reason },
    };
  }

  // Extract literal arguments; bail if any dep-key arg is non-literal.
  // Args beyond `depKeyArgCount` are "value args" — they can be non-literal
  // (their source text is used verbatim in the getter body via sourceCode.getText).
  const literalArgs = [];
  for (let i = 0; i < argNodes.length; i++) {
    const argNode = argNodes[i];

    // Value args (beyond dep key positions) don't need to be literals
    if (transform.depKeyArgCount != null && i >= transform.depKeyArgCount) {
      literalArgs.push(null);
      continue;
    }

    if (argNode.type === "Literal" && typeof argNode.value === "string") {
      literalArgs.push(argNode.value);
    } else if (
      argNode.type === "Literal" &&
      (typeof argNode.value === "number" || typeof argNode.value === "boolean")
    ) {
      literalArgs.push(argNode.value);
    } else if (argNode.type === "Literal" && argNode.regex) {
      // Regex literal — allowed for `match`
      literalArgs.push(argNode.raw);
    } else if (
      argNode.type === "TemplateLiteral" &&
      argNode.expressions.length === 0
    ) {
      // Static template literal like `foo`
      literalArgs.push(argNode.quasis[0].value.cooked);
    } else {
      // Non-literal argument → can't auto-fix
      return {
        ...base,
        literalArgs,
        dependentKeys: [],
        allLocal: false,
        canAutoFix: false,
        messageId: "cannotAutoFixDynamic",
        reportData: { name: macroName },
      };
    }
  }

  // Build transform args
  const transformArgs = { literalArgs, argNodes, propName, sourceCode };

  // Compute dependent keys
  const dependentKeys = transform.toDependentKeys(transformArgs);

  // Check for self-referencing getter
  const depPaths = dependentKeys.map((k) => k.split(".")[0]);
  if (depPaths.includes(propName)) {
    return {
      ...base,
      literalArgs,
      dependentKeys,
      allLocal: false,
      canAutoFix: false,
      messageId: "cannotAutoFixSelfReference",
      reportData: { name: macroName, propName },
    };
  }

  const allLocal = dependentKeys.every(isLocalKey);

  // Determine which local deps need @tracked
  let trackedDeps;
  let existingNodesToDecorate;
  if (allLocal) {
    const info = findDepsNeedingTracked(propertyNode, dependentKeys);
    trackedDeps = info.depsToInsert;
    existingNodesToDecorate = info.existingNodesToDecorate;
  }

  return {
    ...base,
    literalArgs,
    dependentKeys,
    allLocal,
    canAutoFix: true,
    trackedDeps,
    existingNodesToDecorate,
  };
}

// ---------------------------------------------------------------------------
// Tracked dep post-processing
// ---------------------------------------------------------------------------

/**
 * Remove tracked deps and nodes-to-decorate that correspond to other macro
 * usages being converted to getters in the same class. After conversion,
 * those properties will be getters (reactive by nature), so adding `@tracked`
 * would create a duplicate class member.
 *
 * @param {MacroUsage[]} usages
 */
function excludeDepsBeingConverted(usages) {
  // Group fixable usage prop names and property nodes by ClassBody
  const convertedByClass = new Map();
  for (const usage of usages) {
    if (!usage.canAutoFix) {
      continue;
    }
    const classBody = usage.propertyNode.parent;
    if (!convertedByClass.has(classBody)) {
      convertedByClass.set(classBody, { names: new Set(), nodes: new Set() });
    }
    const entry = convertedByClass.get(classBody);
    entry.names.add(usage.propName);
    entry.nodes.add(usage.propertyNode);
  }

  for (const usage of usages) {
    const classBody = usage.propertyNode?.parent;
    const converted = convertedByClass.get(classBody);
    if (!converted) {
      continue;
    }

    if (usage.trackedDeps) {
      usage.trackedDeps = usage.trackedDeps.filter(
        (dep) => !converted.names.has(dep)
      );
    }
    if (usage.existingNodesToDecorate) {
      usage.existingNodesToDecorate = usage.existingNodesToDecorate.filter(
        (node) => !converted.nodes.has(node)
      );
    }
  }
}

/**
 * Ensure each new `@tracked` dep name is assigned to at most ONE usage.
 * Without this, two macros referencing the same dep would both try to
 * insert `@tracked propName;` (since new declarations are prepended to
 * each property replacement to avoid range overlaps).
 *
 * Note: `existingNodesToDecorate` is NOT deduplicated here — those are
 * aggregated centrally in the import-level fix via a Set.
 *
 * @param {MacroUsage[]} usages
 */
function deduplicateTrackedDeps(usages) {
  const claimedDeps = new Set();

  for (const usage of usages) {
    if (usage.trackedDeps) {
      usage.trackedDeps = usage.trackedDeps.filter((dep) => {
        if (claimedDeps.has(dep)) {
          return false;
        }
        claimedDeps.add(dep);
        return true;
      });
    }
  }
}

// ---------------------------------------------------------------------------
// @tracked dependency detection
// ---------------------------------------------------------------------------

// Decorators that make a property reactive (equivalent to @tracked).
// Members with these decorators do not need @tracked added.
const TRACKED_DECORATORS = new Set([
  "tracked",
  "trackedArray",
  "dedupeTracked",
  "resettableTracked",
]);

/**
 * @typedef {Object} TrackedDepsInfo
 * @property {string[]} depsToInsert - Deps that need a NEW `@tracked propName;` declaration
 * @property {import('estree').Node[]} existingNodesToDecorate - Existing PropertyDefinition
 *   nodes that need `@tracked` added as a decorator
 */

/**
 * Given a PropertyDefinition inside a class body, determine which local
 * dependent keys need `@tracked` handling:
 *
 * - Keys matching a MethodDefinition (getter/method) → already reactive, skip
 * - Keys declared as PropertyDefinition with a tracked-like decorator
 *   (@tracked, @trackedArray, @dedupeTracked, @resettableTracked) → skip
 * - Keys declared as PropertyDefinition without tracking → need `@tracked` added
 * - Keys not declared as any class member → need a new `@tracked propName;` inserted
 *
 * @param {import('estree').Node} propertyNode - The PropertyDefinition node
 * @param {string[]} dependentKeys - Local-only dependent keys (no dots)
 * @returns {TrackedDepsInfo}
 */
function findDepsNeedingTracked(propertyNode, dependentKeys) {
  const classBody = propertyNode.parent;
  if (!classBody || classBody.type !== "ClassBody") {
    return { depsToInsert: [...dependentKeys], existingNodesToDecorate: [] };
  }

  const reactiveMembers = new Set(); // getters, methods, and tracked properties
  const untrackedMemberNodes = new Map(); // name → AST node

  for (const member of classBody.body) {
    // Getters and methods are already reactive — no @tracked needed
    if (member.type === "MethodDefinition") {
      const name =
        member.key.type === "Identifier"
          ? member.key.name
          : String(member.key.value);
      reactiveMembers.add(name);
      continue;
    }

    if (member.type !== "PropertyDefinition") {
      continue;
    }

    const name =
      member.key.type === "Identifier"
        ? member.key.name
        : String(member.key.value);

    const hasTrackedLike =
      member.decorators?.some((d) => {
        const expr = d.expression;
        return (
          (expr.type === "Identifier" && TRACKED_DECORATORS.has(expr.name)) ||
          (expr.type === "CallExpression" &&
            expr.callee?.type === "Identifier" &&
            TRACKED_DECORATORS.has(expr.callee.name))
        );
      }) ?? false;

    if (hasTrackedLike) {
      reactiveMembers.add(name);
    } else {
      untrackedMemberNodes.set(name, member);
    }
  }

  const depsToInsert = [];
  const existingNodesToDecorate = [];

  for (const key of dependentKeys) {
    if (reactiveMembers.has(key)) {
      continue; // already reactive (getter, method, or @tracked)
    }
    if (untrackedMemberNodes.has(key)) {
      existingNodesToDecorate.push(untrackedMemberNodes.get(key));
    } else {
      depsToInsert.push(key);
    }
  }

  return { depsToInsert, existingNodesToDecorate };
}

// ---------------------------------------------------------------------------
// AST walker
// ---------------------------------------------------------------------------

/**
 * Simple recursive AST walker that calls `visitor(node)` for every node.
 *
 * @param {import('estree').Node} node
 * @param {(node: import('estree').Node) => void} visitor
 */
function walkNode(node, visitor) {
  if (!node || typeof node !== "object") {
    return;
  }

  visitor(node);

  for (const key in node) {
    if (key === "parent" || key === "range" || key === "loc") {
      continue;
    }
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item.type === "string") {
          walkNode(item, visitor);
        }
      }
    } else if (child && typeof child.type === "string") {
      walkNode(child, visitor);
    }
  }
}
