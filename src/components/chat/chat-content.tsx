import { memo, useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";

import { Chat, ChatQuestion } from "@/types/chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import CodeReferences from "@/components/code-references";
import MarkdownRenderer from "@/components/markdown-renderer";

import { useChatContext } from "./chat-context";

// Question item component to prevent unnecessary re-renders
const ChatQuestionItem = memo(
  ({
    qa,
    isLoadingReferences = false,
    isFirstQuestion = false,
  }: {
    qa: ChatQuestion;
    isLoadingReferences?: boolean;
    isFirstQuestion?: boolean;
  }) => {
    const isLoading =
      qa.answer === "Getting answer..." || qa.answerLoading === true;

    // Use a ref to track mounting
    const mountedRef = useRef(false);
    const { updateChat } = useChatContext();

    // Force loading state to end immediately for first question after a delay
    useEffect(() => {
      mountedRef.current = true;

      // Shorter timeout for first question
      const timeoutDelay = isFirstQuestion ? 1000 : 3000;

      // Only create timeout if currently in loading state
      if (
        (isLoadingReferences || qa.referencesLoading) &&
        qa.filesReferences?.length > 0
      ) {
        const timer = setTimeout(() => {
          if (mountedRef.current) {
            // For the first question, update it directly instead of using an event
            if (isFirstQuestion) {
              // Fix: Update the chat directly with proper types
              window.dispatchEvent(
                new CustomEvent("forceUpdateReferences", {
                  detail: { questionId: qa.id, forceUpdate: true },
                }),
              );
            } else {
              // Use event approach for non-first questions
              window.dispatchEvent(
                new CustomEvent("forceUpdateReferences", {
                  detail: { questionId: qa.id },
                }),
              );
            }
          }
        }, timeoutDelay);

        return () => {
          clearTimeout(timer);
          mountedRef.current = false;
        };
      }
    }, [
      qa.id,
      isLoadingReferences,
      qa.referencesLoading,
      qa.filesReferences?.length,
      isFirstQuestion,
      updateChat,
    ]);

    // Always show references if they exist, even if in loading state
    const forceShowReferences = Boolean(
      qa.filesReferences && qa.filesReferences.length > 0,
    );

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

          {/* Show references section when there are files or while loading */}
          {forceShowReferences && (
            <div className="ml-11 w-[85%]">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">
                    Code References
                    {qa.filesReferences.length > 0 &&
                      ` (${qa.filesReferences.length})`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CodeReferences
                    filesReferences={qa.filesReferences || []}
                    isLoading={false}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  },
);

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
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  streamQuestion?: string;
  streamProcessing?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const { updateChat } = useChatContext();

  // Listen for force update events
  useEffect(() => {
    const handleForceUpdate = (e: Event) => {
      const { questionId, forceUpdate } = (e as CustomEvent).detail;

      if (chat && Array.isArray(chat.questions)) {
        // Update the specific question to not be in loading state
        const updatedQuestions = chat.questions.map((q: ChatQuestion) => {
          if (q.id === questionId || forceUpdate === true) {
            return {
              ...q,
              referencesLoading: false,
            };
          }
          return q;
        });

        // Force update the chat - fix the type by removing refreshId
        // Create a proper Chat object
        const updatedChat: Chat = {
          ...chat,
          questions: updatedQuestions,
        };

        // Update the chat
        updateChat(updatedChat);

        // Trigger a re-render with setTimeout
        setTimeout(() => {
          updateChat({ ...updatedChat });
        }, 50);
      }
    };

    window.addEventListener("forceUpdateReferences", handleForceUpdate);
    return () => {
      window.removeEventListener("forceUpdateReferences", handleForceUpdate);
    };
  }, [chat, updateChat]);

  // Improved scroll behavior with a safer approach
  useEffect(() => {
    // Reset scroll flag when chat changes
    if (chat?.id) {
      hasScrolledRef.current = false;
    }

    // Schedule scroll to happen after render
    const scrollTimer = setTimeout(() => {
      if (messagesEndRef.current && !hasScrolledRef.current) {
        // Use scrollIntoView with a block: 'end' option to ensure full visibility
        messagesEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end", // This ensures we scroll all the way to the bottom
        });

        // Set scroll flag to avoid redundant scrolling
        hasScrolledRef.current = true;

        // Double-check scroll position after animations
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
              behavior: "smooth",
              block: "end",
            });
          }
        }, 50);
      }
    }, 100);

    return () => clearTimeout(scrollTimer);
  }, [chat?.id, chat?.questions?.length, streamQuestion, messagesEndRef]);

  // Early exit if no chat data
  if (!chat || !Array.isArray(chat.questions)) {
    return null;
  }

  // Check if the stream question is already in chat
  const hasMatchingQuestion =
    streamProcessing && streamQuestion
      ? chat.questions.some((q) => q.question === streamQuestion)
      : false;

  return (
    <ScrollArea className="h-full px-4">
      <div className="space-y-6 py-6" ref={contentRef}>
        {/* Pass the referencesLoading flag to each question */}
        {chat.questions.map((qa, index) => (
          <ChatQuestionItem
            key={qa.id || `qa-${qa.question}`}
            qa={qa}
            isLoadingReferences={qa.referencesLoading || false}
            isFirstQuestion={index === 0}
          />
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
