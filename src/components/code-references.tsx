"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLanguageFromFilename } from "@/utils/code-language";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

import { FileReference } from "@/types/chat";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CollapsibleContent } from "@/components/collapsible-content";

type CodeReferencesProps = {
  filesReferences: FileReference[];
  isLoading?: boolean;
};

// Maximum number of lines to display for performance
const MAX_LINES = 250;

export default function CodeReferences({
  filesReferences,
  isLoading = false,
}: CodeReferencesProps) {
  const [activeTab, setActiveTab] = useState(
    filesReferences[0]?.fileName || "",
  );
  const [loadedTabs, setLoadedTabs] = useState<string[]>([]);
  const prevTabRef = useRef<string>(activeTab);
  const [localLoading, setLocalLoading] = useState(isLoading);
  const hasRenderedRef = useRef(false);

  // Immediately set all tabs as loaded and turn off loading after initial render
  useEffect(() => {
    // Initialize component
    if (!hasRenderedRef.current && filesReferences.length > 0) {
      hasRenderedRef.current = true;

      // Ensure active tab is set
      if (activeTab === "" && filesReferences[0]?.fileName) {
        setActiveTab(filesReferences[0].fileName);
      }

      // Load all tabs immediately
      const allFileNames = filesReferences
        .map((file) => file.fileName)
        .filter(Boolean);
      setLoadedTabs(allFileNames);

      // Force loading to end after 1.5 seconds regardless of state
      const forceTimer = setTimeout(() => {
        setLocalLoading(false);
      }, 1500);

      return () => clearTimeout(forceTimer);
    }
  }, [filesReferences, activeTab]);

  // Forcefully end loading after 2 seconds maximum
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localLoading) {
        setLocalLoading(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [localLoading]);

  // Disable loading if content is available
  useEffect(() => {
    const hasContent = filesReferences.some(
      (file) => file.sourceCode && file.sourceCode.trim() !== "",
    );

    if (hasContent && localLoading) {
      // Content is available, no need to keep loading
      setLocalLoading(false);
    }
  }, [filesReferences, localLoading]);

  // Function to truncate code if it's too long - memoized to avoid recalculation
  const truncateCode = useCallback((code: string): string => {
    if (!code) return ""; // Handle empty code

    const lines = code.split("\n");
    if (lines.length <= MAX_LINES) return code;

    const truncatedLines = lines.slice(0, MAX_LINES);
    truncatedLines.push(
      `\n// ... ${lines.length - MAX_LINES} more lines (truncated for performance) ...`,
    );
    return truncatedLines.join("\n");
  }, []);

  // Pre-process all files, but only store a lookup map instead of transformed objects
  const fileCodeMap = useMemo(() => {
    const map = new Map<string, string>();

    // Initialize with empty strings for all files to prevent undefined issues
    filesReferences.forEach((file) => {
      // Use placeholder text for empty content
      const content = file.sourceCode
        ? truncateCode(file.sourceCode)
        : "// Content will appear here when loaded...";

      // Always set initial content to prevent undefined later
      map.set(file.fileName, content);
    });

    return map;
  }, [filesReferences, truncateCode]);

  // Handle tab change
  const handleTabChange = useCallback(
    (tabName: string) => {
      // Save previous tab for animation
      prevTabRef.current = activeTab;
      setActiveTab(tabName);

      // Add to loaded tabs if not already loaded
      if (!loadedTabs.includes(tabName)) {
        setLoadedTabs((prev) => [...prev, tabName]);
      }
    },
    [activeTab, loadedTabs],
  );

  // Lazily process the source code for a tab when it becomes active
  useEffect(() => {
    // Process source code for the new tab if it's not already in the map
    if (!fileCodeMap.has(activeTab)) {
      const file = filesReferences.find((f) => f.fileName === activeTab);
      if (file && file.sourceCode) {
        // Add the truncated code to the map
        fileCodeMap.set(activeTab, truncateCode(file.sourceCode));
      }
    }
  }, [activeTab, fileCodeMap, filesReferences, truncateCode]);

  if (!filesReferences.length) return null;

  // Skeleton loading UI
  if (localLoading) {
    return (
      <div className="w-full">
        <div className="scrollbar-hide mb-2 flex gap-2 overflow-auto rounded-md border bg-muted p-1 shadow-xs">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="rounded-lg border">
          <div className="rounded-lg rounded-b-none bg-muted px-4 py-1.5 text-sm">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="p-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <div className="scrollbar-hide mb-2 flex gap-2 overflow-auto rounded-md border bg-muted p-1 shadow-xs">
        {filesReferences.map((file) => (
          <button
            key={file.fileName}
            onClick={() => handleTabChange(file.fileName)}
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

      {/* Only render content for tabs that have been viewed */}
      {filesReferences.map((file) => {
        // Skip rendering if tab hasn't been activated yet
        if (!loadedTabs.includes(file.fileName)) {
          return <TabsContent key={file.fileName} value={file.fileName} />;
        }

        // Get the truncated code from the map or use a helpful message
        const codeToRender =
          fileCodeMap.get(file.fileName) ||
          "// Content unavailable. Try refreshing the page.";

        return (
          <TabsContent
            key={file.fileName}
            value={file.fileName}
            className="mt-0 transition-opacity duration-150"
          >
            <CollapsibleContent
              maxHeight={300}
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
                    {codeToRender}
                  </SyntaxHighlighter>
                </div>
              }
            />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
