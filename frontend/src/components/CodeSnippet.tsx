import { useState } from 'react';
import { TerminalWindowIcon, CopyIcon, CheckIcon } from './Icons';

interface CodeSnippetProps {
  filename?: string;
  showNumbers?: boolean;
  lines?: number;
  code: string;
  language?: string;
  highlightedCode: React.ReactNode;
}

export function CodeSnippet({ 
  filename, 
  showNumbers = true, 
  lines = 6,
  code,
  language,
  highlightedCode
}: CodeSnippetProps) {
  const [isCopied, setIsCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className="border border-gb-bg-light bg-[#1d2021] relative group rounded-none shadow-md mb-6" dir="ltr">
      {/* Header bar showing filename */}
      {filename && (
        <div className="bg-gb-bg-soft/80 px-4 py-2 flex items-center justify-between border-b border-gb-bg-light">
          <div className="flex items-center gap-3">
            <span className="text-gb-blue-light">
              <TerminalWindowIcon className="w-4 h-4" />
            </span>
            <span className="text-xs font-mono text-gb-fg-dark tracking-wider uppercase">
              {filename}
            </span>
          </div>
          <button 
            onClick={handleCopy}
            className="text-gb-fg-dark hover:text-gb-fg flex items-center gap-1.5 transition-colors px-2 py-1 bg-[#1d2021] hover:bg-gb-bg-soft border border-gb-bg-light rounded-none text-xs font-mono cursor-pointer"
            title="Copy code"
          >
            {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-gb-green-light" /> : <CopyIcon className="w-3.5 h-3.5" />}
            <span>{isCopied ? "Copied!" : "Copy"}</span>
          </button>
        </div>
      )}

      {/* Floating fallback button when no header is present */}
      {!filename && (
        <button 
          onClick={handleCopy}
          className="absolute top-3 right-3 z-10 text-gb-fg-dark hover:text-gb-fg flex items-center gap-1 transition-colors px-2 py-1 bg-[#1d2021] hover:bg-gb-bg-soft border border-gb-bg-light rounded-none text-xs font-mono cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Copy code"
        >
          {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-gb-green-light" /> : <CopyIcon className="w-3.5 h-3.5" />}
          <span className="sr-only">Copy</span>
        </button>
      )}

      {/* Code body and optional line numbering */}
      <div className="flex">
        {showNumbers && (
          <div className="hidden sm:flex flex-col text-right px-4 py-4 border-r border-gb-bg-light/50 text-gb-fg-dark/30 font-mono text-sm sm:text-base select-none bg-[#1d2021]">
            {Array.from({ length: lines }).map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        )}
        <div className="p-4 overflow-x-auto font-mono text-sm sm:text-base leading-relaxed w-full">
          {highlightedCode}
        </div>
      </div>
    </div>
  );
}
