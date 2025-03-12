import { Fragment, memo, RefObject, useEffect } from "react";
import { Bot, User } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import CodeReferences from "@/components/code-references";
import MarkdownRenderer from "@/components/markdown-renderer";

interface ChatContentProps {
  chat: any; // Replace with proper type when available
  streamContent: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

// Message component for better performance through memoization
const Message = memo(({ question }: { question: any }) => {
  const isLoading = question.answer === "Getting answer...";

  return (
    <Fragment>
      {/* User Question */}
      <div className="flex justify-end gap-3">
        <div className="max-w-[75%] break-words rounded-lg bg-primary p-4 text-primary-foreground">
          <p>{question.question}</p>
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
          <div className="max-w-[85%] rounded-lg  bg-card p-4 overflow-hidden shadow border">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                <span>Getting answer...</span>
              </div>
            ) : (
              <div className="overflow-auto">
                <MarkdownRenderer content={question.answer} />
              </div>
            )}
          </div>
        </div>

        {/* Code References - Only show if not loading and references exist */}
        {!isLoading &&
          question.filesReferences &&
          question.filesReferences.length > 0 && (
            <div className="ml-11 w-[85%]">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Code References</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CodeReferences filesReferences={question.filesReferences} />
                </CardContent>
              </Card>
            </div>
          )}
      </div>
    </Fragment>
  );
});

Message.displayName = "Message";

// ChatContent component with better null checks
const ChatContent = memo(function ChatContent({
  chat,
  streamContent,
  messagesEndRef,
}: ChatContentProps) {
  // Add null checking for chat and chat.questions
  const hasQuestions =
    chat && Array.isArray(chat.questions) && chat.questions.length > 0;

  // Scroll to bottom whenever content changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat, streamContent, messagesEndRef]);

  // Debug chat structure
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      if (chat) {
        console.log("Chat structure:", {
          id: chat.id,
          title: chat.title,
          questionCount: chat.questions?.length || 0,
        });
      }
    }
  }, [chat]);

  return (
    <ScrollArea className="h-full px-4">
      <div className="space-y-6 py-6">
        {/* Show a debugging message if questions array is empty but we have a chat */}
        {chat && (!chat.questions || chat.questions.length === 0) && (
          <div className="text-muted-foreground text-center py-4">
            {process.env.NODE_ENV === "development" && (
              <p>Chat exists but has no questions. Chat ID: {chat.id}</p>
            )}
          </div>
        )}

        {/* Map through questions if they exist */}
        {hasQuestions &&
          chat.questions.map((question: any, index: number) => (
            <Message
              key={question.id || `q-${index}-${Date.now()}`}
              question={question}
            />
          ))}

        {/* Streaming response */}
        {streamContent && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="max-w-[85%] rounded-lg bg-muted p-4 overflow-hidden">
                <div className="overflow-auto">
                  <MarkdownRenderer content={streamContent} />
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
});

export default ChatContent;
