/**
 * @fileoverview ESLint rule enforcing a consistent order of class members.
 *
 * Vendored from `eslint-plugin-sort-class-members` v1.22.1 (MIT) so the
 * autofix can move each member together with its comments and decorators.
 * The options, matching semantics, and messages are unchanged.
 */

import { sortClassMembersSchema } from "./sort-class-members/schema.mjs";
import {
  findAccessorPairProblems,
  findProblems,
  getClassMemberInfos,
  getExpectedOrder,
  getMemberDescription,
} from "./sort-class-members/sort-class-members-analysis.mjs";
import { createClassBodyFix } from "./sort-class-members/sort-class-members-fixer.mjs";

const ORDER = "Expected {{ source }} to come {{ expected }} {{ target }}.";
const ACCESSOR_PAIR =
  "Expected {{ source }} to come immediately {{ expected }} {{ target }}.";
const MORE = " ({{ more }} similar {{ problem }} in this class)";

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce a consistent order of class members",
    },
    fixable: "code",
    schema: sortClassMembersSchema,
    messages: {
      order: ORDER,
      orderMore: ORDER + MORE,
      accessorPair: ACCESSOR_PAIR,
      accessorPairMore: ACCESSOR_PAIR + MORE,
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const stopAfterFirst = !!options.stopAfterFirstProblem;
    const positioning = options.accessorPairPositioning || "getThenSet";
    const groupAccessors = positioning !== "any";
    const orderedSlots = getExpectedOrder(
      options.order || [],
      options.groups || {}
    );
    const collator = new Intl.Collator(options.locale || "en-US");
    const sourceCode = context.sourceCode;

    function checkClass(node) {
      const allMembers = getClassMemberInfos(node, sourceCode, orderedSlots);
      // One fix rewrites the whole body, so only the first report carries it.
      let fix = createClassBodyFix({
        sourceCode,
        classBody: node.body,
        members: allMembers,
        positioning,
        collator,
      });

      function report(problem, messageId, problemCount) {
        const more = stopAfterFirst && problemCount > 1;
        const data = {
          source: getMemberDescription(problem.source, groupAccessors),
          target: getMemberDescription(problem.target, groupAccessors),
          expected: problem.expected,
        };
        if (more) {
          data.more = problemCount - 1;
          data.problem = problemCount === 2 ? "problem" : "problems";
        }

        context.report({
          node: problem.source.node,
          messageId: more ? `${messageId}More` : messageId,
          data,
          fix,
        });
        fix = null;
      }

      const pairProblems = findAccessorPairProblems(allMembers, positioning);
      for (const problem of pairProblems) {
        report(problem, "accessorPair", pairProblems.length);
        if (stopAfterFirst) {
          break;
        }
      }

      // The second accessor of each pair and members that match no slot are
      // not compared, as upstream does.
      const members = allMembers.filter(
        (member) =>
          !(member.matchingAccessor && !member.isFirstAccessor) &&
          member.acceptableSlots.length
      );
      const problems = findProblems(members, collator);
      for (const problem of problems) {
        report(problem, "order", problems.length);
        if (stopAfterFirst) {
          break;
        }
      }
    }

    const visitors = {
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
    };
    if (options.sortInterfaces) {
      visitors.TSInterfaceDeclaration = checkClass;
    }
    return visitors;
  },
};
