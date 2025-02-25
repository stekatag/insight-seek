import React from "react";
import ReactMarkdown from "react-markdown";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({
  content,
  className = "",
}: MarkdownRendererProps) {
  return (
    <div className={`max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          // Custom heading components with proper spacing and styling
          h1: ({ node, ...props }) => (
            <h1 className="mb-4 mt-6 text-2xl font-bold" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="mb-3 mt-5 text-xl font-bold" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="mb-2 mt-4 text-lg font-bold" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="mb-2 mt-3 text-base font-bold" {...props} />
          ),

          // List styling
          ul: ({ node, ...props }) => (
            <ul className="mb-4 mt-2 list-disc pl-6" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="mb-4 mt-2 list-decimal pl-6" {...props} />
          ),
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,

          // Paragraph spacing
          p: ({ node, ...props }) => <p className="mb-2" {...props} />,

          // Blockquote styling
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="my-4 border-l-4 border-gray-300 pl-4 italic dark:border-gray-700"
              {...props}
            />
          ),

          // Bold and italic
          strong: ({ node, ...props }) => (
            <strong className="font-bold" {...props} />
          ),
          em: ({ node, ...props }) => <em className="italic" {...props} />,

          // Link styling
          a: ({ node, ...props }) => (
            <a
              className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              {...props}
            />
          ),

          // Horizontal rule
          hr: ({ node, ...props }) => (
            <hr
              className="my-6 border-gray-300 dark:border-gray-700"
              {...props}
            />
          ),

          // Table styling
          table: ({ node, ...props }) => (
            <div className="my-4 overflow-x-auto">
              <table
                className="min-w-full border border-gray-300 dark:border-gray-700"
                {...props}
              />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-gray-100 dark:bg-gray-800" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody
              className="divide-y divide-gray-300 dark:divide-gray-700"
              {...props}
            />
          ),
          tr: ({ node, ...props }) => (
            <tr
              className="divide-x divide-gray-300 dark:divide-gray-700"
              {...props}
            />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-2 text-left font-bold" {...props} />
          ),
          td: ({ node, ...props }) => <td className="px-4 py-2" {...props} />,

          // Code blocks with syntax highlighting
          code(props) {
            const { children, className, node, ref, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");

            if (match) {
              const language = match[1] === "astro" ? "tsx" : match[1];
              return (
                <div className="my-4 overflow-hidden rounded-lg shadow-md">
                  <div className="rounded-lg border">
                    <div className="rounded-lg rounded-b-none bg-muted px-4 py-1.5 text-sm">
                      {match[1]}
                    </div>
                    <SyntaxHighlighter
                      {...rest}
                      children={String(children).replace(/\n$/, "")}
                      language={language}
                      customStyle={{ margin: 0 }}
                      style={atomDark}
                    />
                  </div>
                </div>
              );
            }

            return (
              <code {...rest} className={className}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
