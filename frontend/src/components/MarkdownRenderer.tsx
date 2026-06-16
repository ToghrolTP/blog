import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
}

const getText = (children: React.ReactNode): string => {
  let text = '';
  React.Children.forEach(children, child => {
    if (typeof child === 'string') text += child;
    else if (typeof child === 'object' && child && 'props' in child) {
      text += getText((child as any).props.children);
    }
  });
  return text;
};

const getDir = (children: React.ReactNode) => {
  const text = getText(children);
  return /^[\u0600-\u06FF]/.test(text.trim()) ? 'rtl' : 'ltr';
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        h1: ({node, children, ...props}) => <h1 className="text-3xl font-bold text-gb-fg mt-10 mb-6 font-mono" dir={getDir(children)} {...props}>{children}</h1>,
        h2: ({node, children, ...props}) => <h2 className="text-2xl font-bold text-gb-yellow-light mt-8 mb-4 font-mono" dir={getDir(children)} {...props}>{children}</h2>,
        h3: ({node, children, ...props}) => <h3 className="text-xl font-bold text-gb-aqua-light mt-6 mb-3 font-mono" dir={getDir(children)} {...props}>{children}</h3>,
        p: ({node, children, ...props}) => <p className="text-gb-fg leading-relaxed mb-6" dir={getDir(children)} {...props}>{children}</p>,
        a: ({node, ...props}) => <a className="text-gb-blue-light underline hover:text-gb-blue transition-colors" {...props} />,
        ul: ({node, children, ...props}) => <ul className="list-disc list-outside mx-6 mb-6 text-gb-fg" dir={getDir(children)} {...props}>{children}</ul>,
        ol: ({node, children, ...props}) => <ol className="list-decimal list-outside mx-6 mb-6 text-gb-fg" dir={getDir(children)} {...props}>{children}</ol>,
        li: ({node, children, ...props}) => <li className="mb-2 px-2" dir={getDir(children)} {...props}>{children}</li>,
        blockquote: ({node, children, ...props}) => (
          <blockquote className={`border-l-4 border-gb-purple-light px-4 py-1 mb-6 text-gb-fg-dark italic ${getDir(children) === 'rtl' ? 'border-l-0 border-r-4' : ''}`} dir={getDir(children)} {...props}>
            {children}
          </blockquote>
        ),
        img: ({node, src, ...props}) => {
          let finalSrc = src || '';
          let customWidth = '100%';
          
          const splitToken = finalSrc.includes('%23w=') ? '%23w=' : (finalSrc.includes('#w=') ? '#w=' : null);

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
                style={{ width: customWidth, maxWidth: '100%' }}
                className="h-auto border-2 border-gb-fg-dark/20 rounded-none transition-all duration-300 hover:border-gb-orange-light hover:-translate-y-1 hover:shadow-[4px_4px_0_0_rgba(254,128,25,0.3)] object-contain bg-gb-bg-soft"
                {...props} 
              />
            </span>
          );
        },
        table: ({node, children, ...props}) => (
          <div className="overflow-x-auto w-full my-8 border border-gb-fg-dark/20 rounded">
            <table className="w-full text-left border-collapse min-w-[500px]" dir={getDir(children)} {...props}>
              {children}
            </table>
          </div>
        ),
        thead: ({node, children, ...props}) => (
          <thead className="bg-gb-bg-light text-gb-fg font-mono border-b-2 border-gb-fg-dark/50" {...props}>
            {children}
          </thead>
        ),
        tbody: ({node, children, ...props}) => (
          <tbody className="bg-gb-bg text-sm" {...props}>
            {children}
          </tbody>
        ),
        tr: ({node, children, ...props}) => (
          <tr className="border-b border-gb-fg-dark/20 hover:bg-gb-bg-soft transition-colors last:border-b-0" {...props}>
            {children}
          </tr>
        ),
        th: ({node, children, ...props}) => (
          <th className="px-4 py-3 font-semibold text-sm whitespace-nowrap" {...props}>
            {children}
          </th>
        ),
        td: ({node, children, ...props}) => (
          <td className="px-4 py-3 text-sm text-gb-fg align-top" {...props}>
            {children}
          </td>
        ),
        code({node, inline, className, children, ...props}: any) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <div className="mb-6 rounded-none overflow-hidden border border-gb-bg-light" dir="ltr">
              <SyntaxHighlighter
                {...props}
                children={String(children).replace(/\n$/, '')}
                style={vscDarkPlus as any}
                language={match[1]}
                PreTag="div"
                customStyle={{ margin: 0, background: 'var(--color-gb-bg-soft)' }}
              />
            </div>
          ) : (
            <code className="font-mono text-sm bg-gb-bg-soft px-1.5 py-0.5 rounded-none text-gb-aqua-light border border-gb-bg-light" dir="ltr" {...props}>
              {children}
            </code>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
