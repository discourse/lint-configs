export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Ensure marked arrays are sorted",
    },
    fixable: "code",
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();

    return {
      ArrayExpression(node) {
        const checkNodeForComment = (n) => {
          const comments = sourceCode.getCommentsBefore(n);
          return comments.some(
            (c) => c.value.trim() === "eslint-discourse keep-array-sorted"
          );
        };

        let hasSortComment = checkNodeForComment(node);

        if (!hasSortComment) {
          let statement = node;
          while (
            statement &&
            !statement.type.endsWith("Statement") &&
            statement.type !== "VariableDeclaration" &&
            statement.type !== "ExportDefaultDeclaration" &&
            statement.type !== "ExportNamedDeclaration"
          ) {
            statement = statement.parent;
          }
          if (statement && checkNodeForComment(statement)) {
            hasSortComment = true;
          } else if (
            statement &&
            statement.parent &&
            checkNodeForComment(statement.parent)
          ) {
            hasSortComment = true;
          }
        }

        if (!hasSortComment) {
          return;
        }

        const elements = node.elements;
        if (elements.length < 2) {
          return;
        }

        // Check if all elements are Literals and of the same type (string or number)
        const firstType =
          elements[0] && elements[0].type === "Literal"
            ? typeof elements[0].value
            : null;

        if (firstType !== "string" && firstType !== "number") {
          return;
        }

        const canSort = elements.every(
          (el) => el && el.type === "Literal" && typeof el.value === firstType
        );

        if (!canSort) {
          return;
        }

        const sortedElements = [...elements].sort((a, b) => {
          if (a.value < b.value) {
            return -1;
          }
          if (a.value > b.value) {
            return 1;
          }
          return 0;
        });

        const isSorted = elements.every(
          (el, i) => el.value === sortedElements[i].value
        );

        if (!isSorted) {
          context.report({
            node,
            message: "Array should be sorted.",
            fix(fixer) {
              const isMultiline = node.loc.start.line !== node.loc.end.line;

              const line = sourceCode.lines[node.loc.start.line - 1];
              const indent = line.match(/^\s*/)[0];

              let innerIndent = "";
              if (isMultiline && elements.length > 0) {
                const firstElementLine =
                  sourceCode.lines[elements[0].loc.start.line - 1];
                innerIndent = firstElementLine.match(/^\s*/)[0];
              }

              const getElementData = (el) => {
                const text = sourceCode.getText(el);
                const nextToken = sourceCode.getTokenAfter(el);
                const commentsBefore = sourceCode.getCommentsBefore(el);
                let commentsAfter = sourceCode.getCommentsAfter(el);
                if (nextToken && nextToken.value === ",") {
                  commentsAfter = commentsAfter.concat(
                    sourceCode.getCommentsAfter(nextToken)
                  );
                }

                const sameLineCommentsAfter = commentsAfter.filter(
                  (c) => c.loc.start.line === el.loc.end.line
                );

                const leadingComments = commentsBefore
                  .filter((c) => {
                    if (
                      c.value.trim() === "eslint-discourse keep-array-sorted"
                    ) {
                      return false;
                    }
                    // If the comment is on the same line as the previous element OR the previous comma,
                    // it should be treated as a trailing comment of THAT element, not a leading of this one.
                    const prevToken = sourceCode.getTokenBefore(c);
                    if (
                      prevToken &&
                      prevToken.loc.end.line === c.loc.start.line
                    ) {
                      return false;
                    }
                    return true;
                  })
                  .map((c) => sourceCode.getText(c))
                  .join("\n" + innerIndent);

                return {
                  text,
                  leadingComments: leadingComments
                    ? leadingComments + "\n" + innerIndent
                    : "",
                  comment: sameLineCommentsAfter.length
                    ? " " +
                      sameLineCommentsAfter
                        .map((c) => sourceCode.getText(c))
                        .join(" ")
                    : "",
                };
              };

              const elementToData = new Map();
              elements.forEach((el) => {
                elementToData.set(el, getElementData(el));
              });

              if (isMultiline) {
                const lastToken = sourceCode.getLastToken(node);
                const tokenBeforeLast = sourceCode.getTokenBefore(lastToken);
                const hasTrailingComma = tokenBeforeLast.value === ",";

                const lines = sortedElements.map((el, i) => {
                  const d = elementToData.get(el);
                  const isLast = i === elements.length - 1;
                  const comma = !isLast || hasTrailingComma ? "," : "";
                  return `${d.leadingComments}${d.text}${comma}${d.comment}`;
                });

                return fixer.replaceText(
                  node,
                  `[\n${innerIndent}${lines.join(
                    `\n${innerIndent}`
                  )}\n${indent}]`
                );
              } else {
                const content = sortedElements
                  .map((el) => elementToData.get(el).text)
                  .join(", ");
                return fixer.replaceText(node, `[${content}]`);
              }
            },
          });
        }
      },
    };
  },
};
