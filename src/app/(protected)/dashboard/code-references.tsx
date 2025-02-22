"use client";

import { Tabs, TabsContent } from "@/components/ui/tabs";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import React from "react";

type Props = {
  filesReferences: {
    fileName: string;
    sourceCode: string;
  }[];
};

export default function CodeReferences({ filesReferences }: Props) {
  const [tab, setTab] = React.useState(filesReferences[0]?.fileName);

  if (!filesReferences.length) return null;

  return (
    <div className="max-w-[70vw]">
      <Tabs
        defaultValue={tab}
        value={tab}
        onValueChange={(value) => setTab(value)}
      >
        <div className="scrollbar-hide flex gap-2 overflow-scroll rounded-md bg-gray-200 p-1">
          {filesReferences.map((file) => (
            <button
              key={file.fileName}
              onClick={() => setTab(file.fileName)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === file.fileName
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {file.fileName}
            </button>
          ))}
        </div>
        {filesReferences.map((file) => (
          <TabsContent
            key={file.fileName}
            value={file.fileName}
            className="max-h-[40vh] max-w-7xl overflow-scroll rounded-md"
          >
            <SyntaxHighlighter language="typescript" style={atomDark}>
              {file.sourceCode}
            </SyntaxHighlighter>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
