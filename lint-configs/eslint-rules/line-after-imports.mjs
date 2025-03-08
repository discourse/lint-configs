function isTokenOnSameLine(left, right) {
  return left?.loc?.end.line === right?.loc?.start.line;
}

function isSemicolonToken(token) {
  return token.value === ";" && token.type === "Punctuator";
}

export default {
  meta: {
    type: "layout",
    docs: {
      description: "Require an empty line after the imports block",
    },
    fixable: "whitespace",
    schema: [], // no options
  },

  create(context) {
    const sourceCode = context.sourceCode;

    function findLastIndexOfType(nodes, type) {
      return nodes.findLastIndex((node) => node.type === type);
    }

    function findLastConsecutiveTokenAfter(
      prevLastToken,
      nextFirstToken,
      maxLine
    ) {
      const after = sourceCode.getTokenAfter(prevLastToken, {
        includeComments: true,
      });

      if (
        after !== nextFirstToken &&
        after.loc.start.line - prevLastToken.loc.end.line <= maxLine
      ) {
        return findLastConsecutiveTokenAfter(after, nextFirstToken, maxLine);
      }

      return prevLastToken;
    }

    function findFirstConsecutiveTokenBefore(
      nextFirstToken,
      prevLastToken,
      maxLine
    ) {
      const before = sourceCode.getTokenBefore(nextFirstToken, {
        includeComments: true,
      });

      if (
        before !== prevLastToken &&
        nextFirstToken.loc.start.line - before.loc.end.line <= maxLine
      ) {
        return findFirstConsecutiveTokenBefore(before, prevLastToken, maxLine);
      }

      return nextFirstToken;
    }

    function getBoundaryTokens(curNode, nextNode) {
      const lastToken = sourceCode.getLastToken(curNode);
      const prevToken = sourceCode.getTokenBefore(lastToken);
      const nextToken = sourceCode.getFirstToken(nextNode); // skip possible lone `;` between nodes

      const isSemicolonLessStyle =
        isSemicolonToken(lastToken) &&
        !isTokenOnSameLine(prevToken, lastToken) &&
        isTokenOnSameLine(lastToken, nextToken);

      return isSemicolonLessStyle
        ? { curLast: prevToken, nextFirst: lastToken }
        : { curLast: lastToken, nextFirst: nextToken };
    }

    function hasTokenOrCommentBetween(before, after) {
      return (
        sourceCode.getTokensBetween(before, after, {
          includeComments: true,
        }).length !== 0
      );
    }

    return {
      Program(node) {
        const body = node.body;
        const index = findLastIndexOfType(body, "ImportDeclaration");

        if (index === -1) {
          // No imports
          return;
        }

        if (!body[index + 1]) {
          // Nothing after imports
          return;
        }

        const { curLast, nextFirst } = getBoundaryTokens(
          body[index],
          body[index + 1]
        );

        const beforePadding = findLastConsecutiveTokenAfter(
          curLast,
          nextFirst,
          1
        );
        const afterPadding = findFirstConsecutiveTokenBefore(
          nextFirst,
          curLast,
          1
        );
        const isPadded =
          afterPadding.loc.start.line - beforePadding.loc.end.line > 1;
        const hasTokenInPadding = hasTokenOrCommentBetween(
          beforePadding,
          afterPadding
        );
        const curLineLastToken = findLastConsecutiveTokenAfter(
          curLast,
          nextFirst,
          0
        );

        if (isPadded) {
          return;
        }

        context.report({
          node: body[index],
          message: "Expected blank line after imports.",

          fix(fixer) {
            if (hasTokenInPadding) {
              return null;
            }

            return fixer.insertTextAfter(curLineLastToken, "\n");
          },
        });
      },

      // ImportDeclaration(node) {
      //   const modulePath = node.source.value.toLowerCase();

      //   // todo
      // },

      // ClassBody(node) {
      //   const body = node.body;

      //   for (let i = 0; i < body.length - 1; i++) {
      //     const curFirst = sourceCode.getFirstToken(body[i]);
      //     const { curLast, nextFirst } = getBoundaryTokens(
      //       body[i],
      //       body[i + 1]
      //     );
      //     const singleLine = isTokenOnSameLine(curFirst, curLast);
      //     const skip =
      //       singleLine && nodeType(body[i]) === nodeType(body[i + 1]);
      //     const beforePadding = findLastConsecutiveTokenAfter(
      //       curLast,
      //       nextFirst,
      //       1
      //     );
      //     const afterPadding = findFirstConsecutiveTokenBefore(
      //       nextFirst,
      //       curLast,
      //       1
      //     );
      //     const isPadded =
      //       afterPadding.loc.start.line - beforePadding.loc.end.line > 1;
      //     const hasTokenInPadding = hasTokenOrCommentBetween(
      //       beforePadding,
      //       afterPadding
      //     );
      //     const curLineLastToken = findLastConsecutiveTokenAfter(
      //       curLast,
      //       nextFirst,
      //       0
      //     );
      //     const paddingType = getPaddingType(body[i], body[i + 1]);

      //     if (paddingType === "never" && isPadded) {
      //       context.report({
      //         node: body[i + 1],
      //         messageId: "never",

      //         fix(fixer) {
      //           if (hasTokenInPadding) {
      //             return null;
      //           }

      //           return fixer.replaceTextRange(
      //             [beforePadding.range[1], afterPadding.range[0]],
      //             "\n"
      //           );
      //         },
      //       });
      //     } else if (paddingType === "always" && !skip && !isPadded) {
      //       context.report({
      //         node: body[i + 1],
      //         messageId: "always",

      //         fix(fixer) {
      //           if (hasTokenInPadding) {
      //             return null;
      //           }

      //           return fixer.insertTextAfter(curLineLastToken, "\n");
      //         },
      //       });
      //     }
      //   }
      // },
    };
  },
};
