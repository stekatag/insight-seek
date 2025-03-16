import { memo, useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";

import { Chat, ChatQuestion } from "@/types/chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import CodeReferences from "@/components/code-references";
import MarkdownRenderer from "@/components/markdown-renderer";

// Question item component to prevent unnecessary re-renders
const ChatQuestionItem = memo(({ qa }: { qa: ChatQuestion }) => {
  const isLoading =
    qa.answer === "Getting answer..." || qa.answerLoading === true;

  return (
    <div className="space-y-4">
      {/* User Question */}
      <div className="flex justify-end gap-3">
        <div className="max-w-[75%] break-words rounded-lg bg-primary p-4 text-primary-foreground">
          <p>{qa.question}</p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      </div>

      {/* AI Answer */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="max-w-[85%] rounded-lg bg-card p-4 overflow-hidden shadow border">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <span>Getting answer...</span>
              </div>
            ) : (
              <div className="overflow-auto">
                <MarkdownRenderer content={qa.answer} />
              </div>
            )}
          </div>
        </div>

        {/* Code References - only render if needed */}
        {qa.filesReferences && qa.filesReferences.length > 0 && !isLoading && (
          <div className="ml-11 w-[85%]">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Code References</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CodeReferences filesReferences={qa.filesReferences} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
});

// Add display name to fix the error
ChatQuestionItem.displayName = "ChatQuestionItem";

// Main content component with significant performance optimizations
function ChatContent({
  chat,
  messagesEndRef,
  streamQuestion = "",
  streamProcessing = false,
}: {
  chat: Chat;
  // Update type to allow null refs
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  streamQuestion?: string;
  streamProcessing?: boolean;
}) {
  // Use a ref to avoid re-renders on scrolling
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat?.questions?.length, streamQuestion, messagesEndRef]);

  // Early exit if no chat data
  if (!chat || !Array.isArray(chat.questions)) {
    return null;
  }

  // Check if the stream question is already in chat (prevents duplicates)
  const hasMatchingQuestion =
    streamProcessing && streamQuestion
      ? chat.questions.some((q) => q.question === streamQuestion)
      : false;

  return (
    <ScrollArea className="h-full px-4">
      <div className="space-y-6 py-6" ref={contentRef}>
        {/* Map questions with memoized item components */}
        {chat.questions.map((qa) => (
          <ChatQuestionItem key={qa.id || `qa-${qa.question}`} qa={qa} />
        ))}

        {/* Only show processing question if not duplicated */}
        {streamProcessing && streamQuestion && !hasMatchingQuestion && (
          <div className="space-y-4">
            {/* User Question */}
            <div className="flex justify-end gap-3">
              <div className="max-w-[75%] break-words rounded-lg bg-primary p-4 text-primary-foreground">
                <p>{streamQuestion}</p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>

            {/* AI Answer Loading */}
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="max-w-[85%] rounded-lg bg-card p-4 overflow-hidden shadow border">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    <span>Getting answer...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}

// Export memoized version with display name to prevent unnecessary renders
const MemoizedChatContent = memo(ChatContent);
MemoizedChatContent.displayName = "ChatContent";
export default MemoizedChatContent;
