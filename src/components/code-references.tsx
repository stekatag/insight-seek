"use client";

import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CollapsibleContent } from "@/components/collapsible-content";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { getLanguageFromFilename } from "@/utils/code-language";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type FileReference = {
  fileName: string;
  sourceCode: string;
};

type CodeReferencesProps = {
  filesReferences: FileReference[];
};

export default function CodeReferences({
  filesReferences,
}: CodeReferencesProps) {
  const [activeTab, setActiveTab] = useState(
    filesReferences[0]?.fileName || "",
  );

  if (!filesReferences.length) return null;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="scrollbar-hide mb-2 flex gap-2 overflow-auto rounded-md border bg-muted p-1 shadow-sm">
        {filesReferences.map((file) => (
          <button
            key={file.fileName}
            onClick={() => setActiveTab(file.fileName)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === file.fileName
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {file.fileName.split("/").pop()}
          </button>
        ))}
      </div>
      {filesReferences.map((file) => (
        <TabsContent key={file.fileName} value={file.fileName} className="mt-0">
          <CollapsibleContent
            maxHeight={400}
            content={
              <div className="rounded-lg border">
                <div className="rounded-lg rounded-b-none bg-muted px-4 py-1.5 text-sm">
                  {file.fileName}
                </div>
                <SyntaxHighlighter
                  language={getLanguageFromFilename(file.fileName)}
                  style={atomDark}
                  showLineNumbers
                  customStyle={{
                    margin: 0,
                  }}
                >
                  {file.sourceCode}
                </SyntaxHighlighter>
              </div>
            }
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
