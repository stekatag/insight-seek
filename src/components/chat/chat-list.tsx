import { memo } from "react";
import { MessageSquare } from "lucide-react";

import { adaptDatabaseQuestions, Chat } from "@/types/chat";

import { useChatContext } from "./chat-context";

// Change the chat type to accept any to handle database objects
interface ChatListProps {
  chats: any[]; // Accept any type of chat objects, we'll convert them inside
  variant?: "default" | "sidebar"; // 'default' for QA page, 'sidebar' for meeting sidebar
}

export default memo(function ChatList({
  chats,
  variant = "default",
}: ChatListProps) {
  const { openDialog } = useChatContext();

  // Optimized: Handle click on a chat item with immediate feedback
  const handleChatClick = (chat: any) => {
    // Create a properly typed Chat object
    const chatToShow: Chat = {
      id: chat.id,
      title: chat.title,
      questions: adaptDatabaseQuestions(chat.questions || []),
      updatedAt: chat.updatedAt,
      createdAt: chat.createdAt,
      projectId: chat.projectId,
      meetingId: chat.meetingId,
    };

    // Open dialog immediately with existing chat data
    openDialog(chatToShow);
  };

  if (!chats?.length) {
    if (variant === "sidebar") {
      return (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No chat history for this meeting yet.
        </div>
      );
    }
    return null;
  }

  // Sidebar variant (for meeting history)
  if (variant === "sidebar") {
    return (
      <div className="flex flex-col gap-2 p-2">
        <h3 className="mb-2 font-medium">Chat History</h3>
        <div className="flex flex-col gap-2">
          {chats.map((chat) => {
            // First question as title and count of total messages
            const messageCount = chat.questions.length;

            return (
              <div
                key={chat.id}
                onClick={() => handleChatClick(chat)}
                className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-primary/20 p-3 shadow bg-card hover:bg-secondary dark:bg-background dark:hover:bg-primary/10 hover:transition"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <MessageSquare className="h-3 w-3 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col">
                    <p className="line-clamp-1 break-words text-sm font-medium text-gray-700 dark:text-gray-200">
                      {chat.title}
                    </p>
                    <span className="text-xs text-gray-400">
                      {new Date(chat.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 break-words text-xs text-gray-500 dark:text-gray-400">
                    {messageCount} message{messageCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Default variant (for QA page)
  return (
    <div className="flex flex-col gap-2">
      {chats.map((chat) => {
        // First question as title and count of total messages
        const messageCount = chat.questions.length;

        return (
          <div
            key={chat.id}
            onClick={() => handleChatClick(chat)}
            className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-primary/20 p-4 shadow bg-card hover:bg-secondary dark:bg-background dark:hover:bg-primary/10 hover:transition"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <p className="line-clamp-1 break-words text-lg font-medium text-gray-700 dark:text-gray-200">
                  {chat.title}
                </p>
                <span className="shrink-0 text-xs text-gray-400 sm:ml-2">
                  {new Date(chat.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 line-clamp-1 break-words text-sm text-gray-500 dark:text-gray-400">
                {messageCount} message{messageCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
});
