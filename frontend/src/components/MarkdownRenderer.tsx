import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { CodeSnippet } from "./CodeSnippet";

const gruvboxStyle = {
  'code[class*="language-"]': {
    color: "#ebdbb2",
    background: "none",
    fontFamily: "var(--font-code), monospace",
    direction: "ltr",
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    lineHeight: "1.5",
    tabSize: "4",
    hyphens: "none",
  },
  'pre[class*="language-"]': {
    color: "#ebdbb2",
    background: "transparent",
    fontFamily: "var(--font-code), monospace",
    direction: "ltr",
    textAlign: "left",
    whiteSpace: "pre",
    wordSpacing: "normal",
    wordBreak: "normal",
    lineHeight: "1.5",
    tabSize: "4",
    hyphens: "none",
    margin: "0",
    padding: "0",
    overflow: "auto",
  },
  "comment": { color: "#928374", fontStyle: "italic" },
  "prolog": { color: "#928374" },
  "doctype": { color: "#928374" },
  "cdata": { color: "#928374" },
  "punctuation": { color: "#a89984" },
  "property": { color: "#ebdbb2" },
  "tag": { color: "#b16286" },
  "boolean": { color: "#b16286" },
  "number": { color: "#d3869b" },
  "constant": { color: "#d3869b" },
  "symbol": { color: "#b16286" },
  "deleted": { color: "#fb4934" },
  "selector": { color: "#98971a" },
  "attr-name": { color: "#fabd2f" },
  "string": { color: "#98971a" },
  "char": { color: "#98971a" },
  "builtin": { color: "#689d6a" },
  "inserted": { color: "#b8bb26" },
  "operator": { color: "#a89984" },
  "entity": { color: "#ebdbb2" },
  "url": { color: "#ebdbb2" },
  "variable": { color: "#d65d0e" },
  "atrule": { color: "#b16286" },
  "attr-value": { color: "#98971a" },
  "keyword": { color: "#b16286" },
  "function": { color: "#458588" },
  "class-name": { color: "#fabd2f" },
  "regex": { color: "#d65d0e" },
  "important": { color: "#fe8019", fontWeight: "bold" },
  "bold": { fontWeight: "bold" },
  "italic": { fontStyle: "italic" },
};

interface MarkdownRendererProps {
  content: string;
}

const getText = (children: React.ReactNode): string => {
  let text = "";
  React.Children.forEach(children, (child) => {
    if (typeof child === "string") text += child;
    else if (typeof child === "object" && child && "props" in child) {
      text += getText((child as any).props.children);
    }
  });
  return text;
};

const getDir = (children: React.ReactNode) => {
  const text = getText(children);
  return /^[\u0600-\u06FF]/.test(text.trim()) ? "rtl" : "ltr";
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        h1: ({ node, children, ...props }) => (
          <h1
            className="text-2xl sm:text-3xl font-mono font-bold text-gb-fg border-b border-gb-bg-light pb-2 mt-10 mb-6"
            dir={getDir(children)}
            {...props}
          >
            {children}
          </h1>
        ),
        h2: ({ node, children, ...props }) => (
          <h2
            className="text-xl sm:text-2xl font-mono font-bold text-gb-yellow-light border-b border-gb-bg-light pb-2 mt-8 mb-4"
            dir={getDir(children)}
            {...props}
          >
            {children}
          </h2>
        ),
        h3: ({ node, children, ...props }) => (
          <h3
            className="text-lg sm:text-xl font-mono font-bold text-gb-green-light mt-6 mb-3"
            dir={getDir(children)}
            {...props}
          >
            {children}
          </h3>
        ),
        h4: ({ node, children, ...props }) => (
          <h4
            className="text-base sm:text-lg font-mono font-bold text-gb-blue-light mt-4 mb-2"
            dir={getDir(children)}
            {...props}
          >
            {children}
          </h4>
        ),
        h5: ({ node, children, ...props }) => (
          <h5
            className="text-sm sm:text-base font-mono font-bold text-gb-purple-light mt-4 mb-2"
            dir={getDir(children)}
            {...props}
          >
            {children}
          </h5>
        ),
        h6: ({ node, children, ...props }) => (
          <h6
            className="text-xs sm:text-sm font-mono font-bold text-gb-aqua-light mt-4 mb-2"
            dir={getDir(children)}
            {...props}
          >
            {children}
          </h6>
        ),
        p: ({ node, children, ...props }) => (
          <p
            className="text-gb-fg text-lg leading-relaxed mb-6"
            dir={getDir(children)}
            {...props}
          >
            {children}
          </p>
        ),
        a: ({ node, ...props }) => (
          <a
            className="text-gb-blue-light hover:text-gb-orange-light underline decoration-gb-blue-light/30 underline-offset-4 transition-colors cursor-pointer"
            {...props}
          />
        ),
        del: ({ node, ...props }) => (
          <del className="line-through text-gb-fg-dark/60" {...props} />
        ),
        hr: ({ node, ...props }) => (
          <hr className="border-0 border-t border-gb-bg-light/10 my-8" {...props} />
        ),
        ul: ({ node, children, ...props }) => (
          <ul
            className="list-disc list-outside ml-6 space-y-2 mb-6 text-gb-fg text-lg marker:text-gb-fg-dark/50"
            dir={getDir(children)}
            {...props}
          >
            {children}
          </ul>
        ),
        ol: ({ node, children, ...props }) => (
          <ol
            className="list-decimal list-outside ml-6 space-y-2 mb-6 text-gb-fg text-lg marker:text-gb-fg-dark/50 font-mono"
            dir={getDir(children)}
            {...props}
          >
            {children}
          </ol>
        ),
        li: ({ node, children, ...props }) => (
          <li className="mb-2 pl-1" dir={getDir(children)} {...props}>
            {children}
          </li>
        ),
        blockquote: ({ node, children, ...props }) => {
          const isRtl = getDir(children) === "rtl";
          return (
            <blockquote
              className={`border-l-4 border-gb-fg-dark/40 bg-gb-bg-soft/20 p-6 rounded-none mb-6 text-gb-fg-dark italic ${
                isRtl ? "border-l-0 border-r-4" : ""
              }`}
              dir={isRtl ? "rtl" : "ltr"}
              {...props}
            >
              {children}
            </blockquote>
          );
        },
        input: ({ node, checked, disabled, type, ...props }: any) => {
          if (type === "checkbox") {
            return (
              <span
                className={`inline-flex items-center justify-center w-4 h-4 border border-gb-fg-dark/50 rounded-none select-none text-[10px] font-bold leading-none align-middle mr-2 ${
                  checked ? "bg-gb-green-light text-gb-bg" : "bg-gb-bg-soft"
                }`}
              >
                {checked ? "✓" : ""}
              </span>
            );
          }
          return <input type={type} {...props} />;
        },
        img: ({ node, src, ...props }) => {
          let finalSrc = src || "";
          let customWidth = "100%";

          const splitToken = finalSrc.includes("%23w=")
            ? "%23w="
            : (finalSrc.includes("#w=") ? "#w=" : null);

          if (splitToken) {
            const parts = finalSrc.split(splitToken);
            finalSrc = parts[0];
            try {
              customWidth = decodeURIComponent(parts[1]);
            } catch (e) {
              customWidth = parts[1];
            }
          }

          return (
            <span className="flex justify-center w-full my-8">
              <img
                src={finalSrc}
                style={{ width: customWidth, maxWidth: "100%" }}
                className="h-auto border-2 border-gb-fg-dark/20 rounded-none transition-all duration-300 hover:border-gb-orange-light hover:-translate-y-1 hover:shadow-[4px_4px_0_0_rgba(254,128,25,0.3)] object-contain bg-gb-bg-soft"
                {...props}
              />
            </span>
          );
        },
        table: ({ node, children, ...props }) => (
          <div className="overflow-x-auto w-full my-8 border border-gb-bg-light rounded-none">
            <table
              className="w-full text-left text-lg border-collapse min-w-[500px]"
              dir={getDir(children)}
              {...props}
            >
              {children}
            </table>
          </div>
        ),
        thead: ({ node, children, ...props }) => (
          <thead
            className="bg-gb-bg-soft text-gb-yellow-light border-b-2 border-gb-bg-light font-mono"
            {...props}
          >
            {children}
          </thead>
        ),
        tbody: ({ node, children, ...props }) => (
          <tbody
            className="bg-gb-bg text-sm divide-y divide-gb-bg-light"
            {...props}
          >
            {children}
          </tbody>
        ),
        tr: ({ node, children, ...props }) => (
          <tr
            className="border-b border-gb-bg-light/40 hover:bg-gb-bg-soft/30 transition-colors last:border-b-0"
            {...props}
          >
            {children}
          </tr>
        ),
        th: ({ node, children, ...props }) => (
          <th
            className="p-4 font-bold whitespace-nowrap border-b border-gb-bg-light"
            {...props}
          >
            {children}
          </th>
        ),
        td: ({ node, children, ...props }) => (
          <td
            className="p-4 text-gb-fg align-middle border-b border-gb-bg-light/40"
            {...props}
          >
            {children}
          </td>
        ),
        dl: ({ node, ...props }) => (
          <dl
            className="space-y-6 my-6 bg-gb-bg-soft/10 p-6 border border-gb-bg-light rounded-none"
            {...props}
          />
        ),
        dt: ({ node, ...props }) => (
          <dt
            className="text-xl font-bold text-gb-orange-light font-mono"
            {...props}
          />
        ),
        dd: ({ node, ...props }) => (
          <dd
            className="mt-2 text-gb-fg-dark text-base pl-4 border-l border-gb-bg-light/50"
            {...props}
          />
        ),
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          if (!inline && match) {
            const metaString = node?.data?.meta || "";
            const params: Record<string, string> = {};
            const regex = /(\w+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
            let m;
            while ((m = regex.exec(metaString)) !== null) {
              const [, key, val1, val2, val3] = m;
              params[key] = val1 !== undefined
                ? val1
                : (val2 !== undefined
                  ? val2
                  : (val3 !== undefined ? val3 : "true"));
            }

            const filename = params.filename;
            const hasNoNumbers = "noNumbers" in params ||
              params.showNumbers === "false";
            const hasShowNumbers = "showNumbers" in params &&
              params.showNumbers === "true";
            const showNumbers = filename ? !hasNoNumbers : hasShowNumbers;

            const codeContent = String(children).replace(/\n$/, "");
            const lineCount = codeContent.split("\n").length;
            const linesOverride = params.lines
              ? Number(params.lines)
              : undefined;

            return (
              <CodeSnippet
                filename={filename}
                showNumbers={showNumbers}
                lines={linesOverride !== undefined ? linesOverride : lineCount}
                code={codeContent}
                language={match[1]}
                highlightedCode={
                  <SyntaxHighlighter
                    {...props}
                    children={codeContent}
                    style={gruvboxStyle as any}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      padding: 0,
                      background: "transparent",
                    }}
                  />
                }
              />
            );
          } else {
            return (
              <code
                className="font-mono text-sm bg-gb-bg-soft px-1.5 py-0.5 rounded-none text-gb-aqua-light border border-gb-bg-light"
                dir="ltr"
                {...props}
              >
                {children}
              </code>
            );
          }
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
