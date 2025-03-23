import { emojis } from "./emoji";

import * as shiki from "shiki";
type ReplaceCallback = (...args: any) => string;

const hlter = await shiki.createHighlighter({
  langs: Object.keys(shiki.bundledLanguages),
  themes: ["github-light", "github-dark"],
});
function shikiHL(code: string, lang: shiki.BundledLanguage) {
  return hlter.codeToHtml(code, {
    lang: lang,
    themes: { light: "github-light", dark: "github-dark" },
  });
}

/**
 * ptmark converts a string written in a simplified markdown syntax into HTML.
 *
 * @param {string} src - The string to convert.
 * @returns {string} The converted string.
 */
export default function ptmark(src: string): string {
  const rx_lt = /</g;
  const rx_gt = />/g;
  const rx_space = /\t|\r|\uf8ff/g;
  //
  const rx_heading = /(?=^|>|\n)([>\s]*?)(#{1,6}) (.*?)( #*)? *(?=\n|$)/g;
  const rx_blockquote = /\n *&gt; *([^]*?)(?=(\n|$){2})/g;
  const rx_list =
    /\n( *)(?:[*\-+]|((\d+)|([a-z])|[A-Z])[.)]) +([^]*?)(?=(\n|$){2})/g;
  const rx_hr = /^([*\-=_] *){3,}$/gm;
  const rx_listjoin = /<\/(ol|ul)>\n\n<\1>/g;
  const rx_code =
    /(?:^|\n) {0,3}(```+|~~~+) *([^\n\t`~]*)\n([\s\S]*?)\n {0,3}\1/g;

  // ----
  const rx_escape = /\\([\\\|`*_{}\[\]()#+\-~])/g;
  const rx_highlight =
    /(^|[^A-Za-z\d\\])(([*_])|(~)|(\^)|(--)|(\+\+)|`)(\2?)([^<]*?)\2\8(?!\2)(?=\W|_|$)/g;

  const rx_link =
    /((!?)\[(.*?)\]\((.*?)( ".*")?\)|\\([\\`*_{}\[\]()#+\-.!~]))/g;
  const rx_table = /\n(( *\|.*?\| *\n)+)/g;
  const rx_thead = /^.*\n( *\|( *\:?-+\:?-+\:? *\|)* *\n|)/;
  const rx_row = /.*\n/g;
  const rx_cell = /\||(.*?[^\\])\|/g;
  const rx_para = /(?=^|>|\n)\s*\n+([^<]+?)\n+\s*(?=\n|<|$)/g;
  const rx_stash = /-\d+\uf8ff/g;

  const rx_emoji = /:([\S]+?):/g;

  const unescape = (str: string) => {
    return str.replace(rx_escape, "$1");
  };
  const replace = (rex: RegExp, fn: ReplaceCallback) => {
    src = src.replace(rex, fn);
  };
  const element = (tag: string, content: string) => {
    return `<${tag}>${content}</${tag}>`;
  };
  const highlight = (src: string) => {
    return src.replace(
      rx_highlight,
      (all, _, p1, emp, sub, sup, small, big, p2, content) => {
        return (
          _ +
          element(
            emp
              ? p2
                ? "strong"
                : "em"
              : sub
              ? p2
                ? "s"
                : "sub"
              : sup
              ? "sup"
              : small
              ? "small"
              : big
              ? "big"
              : "code",
            highlight(content)
          )
        );
      }
    );
  };

  const blockquote = (src: string) => {
    return src.replace(rx_blockquote, (all, content) => {
      return element(
        "blockquote",
        blockquote(highlight(content.replace(/^ *&gt; */gm, "")))
      );
    });
  };

  const list = (src: string) => {
    return src.replace(rx_list, (all, ind, ol, num, low, content) => {
      const entry = element(
        "li",
        highlight(
          content
            .split(
              RegExp("\n ?" + ind + "(?:(?:\\d+|[a-zA-Z])[.)]|[*\\-+]) +", "g")
            )
            .map(list)
            .join("</li><li>")
        )
      );
      return (
        "\n" +
        (ol
          ? '<ol start="' +
            (num
              ? ol + '">'
              : parseInt(ol, 36) -
                9 +
                '" style="list-style-type:' +
                (low ? "low" : "upp") +
                'er-alpha">') +
            entry +
            "</ol>"
          : element("ul", entry))
      );
    });
  };

  const stash: string[] = [];
  let si = 0;

  src = `\n${src}\n`;

  replace(rx_lt, () => "&lt;");
  replace(rx_gt, () => "&gt;");
  replace(rx_space, () => "  ");

  // blockquote
  src = blockquote(src);

  // horizontal rule
  replace(rx_hr, () => "<hr/>");

  // list
  src = list(src);
  replace(rx_listjoin, () => "");
  // gh code block and highlight with shiki
  src = src.replace(rx_code, function (wholeMatch, delim, language, codeblock) {
    const end = "\n";
    language = language.trim().split(" ")[0];
    codeblock = codeblock.replace(/^\n+/g, ""); // trim leading newlines
    codeblock = codeblock.replace(/\n+$/g, ""); // trim trailing whitespace
    codeblock = codeblock + end;
    return shikiHL(codeblock, language);
  });
  // emojis
  src = src.replace(rx_emoji, (wm, emojiCode) => {
    if (emojis.hasOwnProperty(emojiCode)) {
      return emojis[emojiCode];
    }
    return wm;
  });
  // link or image
  replace(rx_link, function (all, p1, p2, p3, p4, p5, p6) {
    stash[--si] = p4
      ? p2
        ? '<img src="' + p4 + '" alt="' + p3 + '"/>'
        : '<a href="' + p4 + '">' + unescape(highlight(p3)) + "</a>"
      : p6;
    return si + "\uf8ff";
  });

  // table
  replace(rx_table, function (all, table) {
    var sep = table.match(rx_thead)[1];
    return (
      "\n" +
      element(
        "table",
        table.replace(rx_row, function (row, ri) {
          return row == sep
            ? ""
            : element(
                "tr",
                row.replace(rx_cell, function (all, cell, ci) {
                  return ci
                    ? element(
                        sep && !ri ? "th" : "td",
                        unescape(highlight(cell || ""))
                      )
                    : "";
                })
              );
        })
      )
    );
  });
  // heading
  replace(rx_heading, function (all, _, p1, p2) {
    return _ + element("h" + p1.length, unescape(highlight(p2)));
  });

  // paragraph
  replace(rx_para, function (all, content) {
    return element("p", unescape(highlight(content)));
  });

  // stash
  replace(rx_stash, function (all) {
    return stash[parseInt(all)];
  });

  return src.trim();
}

/**
 * Markdown parser, copy from drawdown.js by Adam Leggett.
 * @license MIT License.
 * @see https://github.com/adamvleggett/drawdown
 *
 * Emoji code, Showdown.subParser('makehtml.emoji') and Showdown.subParser('makehtml.githubCodeBlocks') by Showdown.js contributors.
 * @license MIT License.
 * List of supported emojis: https://github.com/showdownjs/showdown/wiki/Emojis
 *
 * Syntax highlight with Shiki
 * @license MIT License.
 * https://shiki.matsu.io/
 */
