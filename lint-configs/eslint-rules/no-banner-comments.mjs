/**
 * @fileoverview Disallow banner-style comments built from a run of repeated
 * punctuation such as dashes, equals signs, or asterisks. Member ordering is
 * self-documenting and such dividers rot as soon as a member moves; a plain
 * section comment in the form of a one-line block comment is the accepted
 * form when a heading is really needed.
 */

const RUN = "[=\\-#~_*]{4,}";
const BARE_RUN = new RegExp(`^${RUN}$`);
const BANNER_LINE = new RegExp(`^(?:${RUN}|${RUN}\\s+\\S.*?\\s+${RUN})$`);

function commentLines(comments) {
  return comments
    .flatMap((comment) => comment.value.split("\n"))
    .map((line) =>
      line
        .trim()
        .replace(/^\*\s*/, "")
        .trim()
    )
    .filter(Boolean);
}

/**
 * A block of comments is a banner when every line is a divider (a bare run
 * of punctuation, or a title framed by two runs), or when it is the classic
 * three-line form of a title between two bare runs. A run inside a longer
 * explanation, such as an underline in a worked example, is not a banner.
 *
 * @param {import("estree").Comment[]} comments One block comment, or a run of
 *   consecutive line comments.
 * @returns {boolean}
 */
function isBanner(comments) {
  const lines = commentLines(comments);
  if (lines.length === 0) {
    return false;
  }
  if (lines.every((line) => BANNER_LINE.test(line))) {
    return true;
  }
  return (
    lines.length === 3 && BARE_RUN.test(lines[0]) && BARE_RUN.test(lines[2])
  );
}

/**
 * Groups comments into candidate blocks: each block comment on its own,
 * except doc blocks (Markdown tables, heading underlines and diagrams
 * legitimately live there), and each run of line comments on consecutive
 * lines together.
 *
 * @param {import("estree").Comment[]} comments
 * @returns {import("estree").Comment[][]}
 */
function groupComments(comments) {
  const groups = [];
  let run = [];
  for (const comment of comments) {
    if (comment.type === "Block") {
      if (run.length) {
        groups.push(run);
        run = [];
      }
      if (!comment.value.startsWith("*")) {
        groups.push([comment]);
      }
      continue;
    }
    const previous = run[run.length - 1];
    if (previous && comment.loc.start.line !== previous.loc.end.line + 1) {
      groups.push(run);
      run = [];
    }
    run.push(comment);
  }
  if (run.length) {
    groups.push(run);
  }
  return groups;
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow banner comments made of repeated punctuation",
    },
    schema: [],
    messages: {
      banner:
        "Do not use banner comments. Use a plain `/* Section */` comment, or none.",
    },
  },

  create(context) {
    return {
      Program() {
        for (const group of groupComments(
          context.sourceCode.getAllComments()
        )) {
          if (isBanner(group)) {
            context.report({
              loc: {
                start: group[0].loc.start,
                end: group[group.length - 1].loc.end,
              },
              messageId: "banner",
            });
          }
        }
      },
    };
  },
};
