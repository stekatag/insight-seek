import { memo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { adaptDatabaseQuestions, Chat } from "@/types/chat";
import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useChatContext } from "./chat-context";
import { DeleteChatDialog } from "./delete-chat-dialog";

// Change the chat type to accept any to handle database objects
interface ChatListProps {
  chats: any[]; // Accept any type of chat objects, we'll convert them inside
  variant?: "default" | "sidebar"; // 'default' for QA page, 'sidebar' for meeting sidebar
}

export default memo(function ChatList({
  chats,
  variant = "default",
}: ChatListProps) {
  const { openDialog, updateChat } = useChatContext();
  const apiUtils = api.useUtils();
  const [deletingChat, setDeletingChat] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Add the delete chat mutation
  const deleteChat = api.qa.deleteChat.useMutation({
    onSuccess: () => {
      toast.success("Chat deleted successfully");
      // Refresh the chat list
      if (deletingChat?.id) {
        // Check if we're in a meeting context or project context
        const isMeeting = location.pathname.includes("/meetings/");

        if (isMeeting) {
          const meetingId = location.pathname.split("/").pop();
          if (meetingId) {
            apiUtils.meetingChat.getMeetingChats.invalidate({ meetingId });
          }
        } else {
          apiUtils.qa.getChats.invalidate();
        }
      }
      setDeletingChat(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete chat");
      setDeletingChat(null);
    },
  });

  // Function to handle delete confirmation
  const confirmDelete = async () => {
    if (!deletingChat) return;
    await deleteChat.mutateAsync({ chatId: deletingChat.id });
  };

  // Original handleChatClick function - keep as is
  const handleChatClick = (chat: any) => {
    // First check if the chat has file references and extract unique file names
    const uniqueFileNames = new Set<string>();

    // Get all existing file names to pre-generate better placeholders
    if (chat.questions) {
      chat.questions.forEach((q: any) => {
        if (q.filesReferences && Array.isArray(q.filesReferences)) {
          q.filesReferences.forEach((ref: any) => {
            if (ref.fileName) {
              uniqueFileNames.add(ref.fileName);
            }
          });
        }
      });
    }

    // Create placeholder questions with loading states
    const questionsWithLoadingState = chat.questions.map((q: any) => {
      // Determine if this question has file references
      const hasRefs =
        q.filesReferences &&
        (Array.isArray(q.filesReferences)
          ? q.filesReferences.length > 0
          : true);

      // Create better placeholders that preserve actual filenames
      const placeholderRefs = hasRefs
        ? Array.isArray(q.filesReferences)
          ? // Preserve actual file names but mark as loading with empty content
            q.filesReferences.map((ref: any) => ({
              fileName: ref.fileName || "Loading file...",
              sourceCode: "", // Empty for loading
              summary: ref.summary || "Loading content...",
            }))
          : // Fallback if not an array
            [...uniqueFileNames].map((fileName) => ({
              fileName,
              sourceCode: "",
              summary: "Loading content...",
            }))
        : [];

      return {
        id: q.id,
        question: q.question,
        answer: q.answer,
        filesReferences: placeholderRefs,
        referencesLoading: hasRefs, // Set loading flag for references
      };
    });

    // Create a display-ready chat with loading indicators
    const immediateDisplayChat: Chat = {
      id: chat.id,
      title: chat.title,
      questions: questionsWithLoadingState,
      updatedAt: chat.updatedAt,
      createdAt: chat.createdAt,
      projectId: chat.projectId,
      meetingId: chat.meetingId,
      isLoading: true,
    };

    // Open dialog IMMEDIATELY with skeleton states
    openDialog(immediateDisplayChat);

    // Process the complete data asynchronously with short timeout
    setTimeout(() => {
      try {
        // Process the questions with file references properly
        const processedQuestions = adaptDatabaseQuestions(
          chat.questions || [],
        ).map((q) => {
          // Make sure each file reference has sourceCode
          const processedReferences = q.filesReferences.map((ref) => ({
            ...ref,
            sourceCode: ref.sourceCode || "",
          }));

          return {
            ...q,
            filesReferences: processedReferences,
            referencesLoading: false, // Explicitly set to false
          };
        });

        const fullyProcessedChat: Chat = {
          ...immediateDisplayChat,
          questions: processedQuestions,
          isLoading: false,
        };

        // Update with fully processed data
        updateChat(fullyProcessedChat);

        // Force a re-render of the content to ensure updates take effect
        setTimeout(() => {
          const refreshedChat = {
            ...fullyProcessedChat,
            refreshId: Date.now(), // Add a unique ID to force refresh
          };
          updateChat(refreshedChat);
        }, 50);
      } catch (error) {
        console.error("Error processing chat data:", error);
        // Update to remove loading state
        updateChat({
          ...immediateDisplayChat,
          isLoading: false,
          questions: immediateDisplayChat.questions.map((q) => ({
            ...q,
            referencesLoading: false,
          })),
        });
      }
    }, 10); // Very short timeout to ensure the skeleton renders first
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
      <>
        <div className="flex flex-col gap-2 ">
          <div className="flex flex-col gap-2">
            {chats.map((chat) => {
              // First question as title and count of total messages
              const messageCount = chat.questions.length;

              return (
                <div
                  key={chat.id}
                  className="group flex w-full cursor-pointer items-start gap-3 rounded-lg border border-primary/20 p-3 shadow bg-card hover:bg-secondary dark:bg-background dark:hover:bg-primary/10 hover:transition"
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChatClick(chat);
                    }}
                  >
                    <MessageSquare className="h-3 w-3 text-primary" />
                  </div>
                  <div
                    className="min-w-0 flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChatClick(chat);
                    }}
                  >
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-3 w-3" />
                        <span className="sr-only">Menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingChat({ id: chat.id, title: chat.title });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </div>
        <DeleteChatDialog
          isOpen={!!deletingChat}
          chatTitle={deletingChat?.title || ""}
          onClose={() => setDeletingChat(null)}
          onConfirm={confirmDelete}
          isDeleting={deleteChat.isPending}
        />
      </>
    );
  }

  // Default variant (for QA page)
  return (
    <>
      <div className="flex flex-col gap-2">
        {chats.map((chat) => {
          // First question as title and count of total messages
          const messageCount = chat.questions.length;

          return (
            <div
              key={chat.id}
              className="group flex w-full cursor-pointer items-start gap-3 rounded-lg border border-primary/20 p-4 shadow bg-card hover:bg-secondary dark:bg-background dark:hover:bg-primary/10 hover:transition"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
                onClick={() => handleChatClick(chat)}
              >
                <MessageSquare className="h-4 w-4 text-primary" />
              </div>
              <div
                className="min-w-0 flex-1"
                onClick={() => handleChatClick(chat)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <p className="line-clamp-1 break-words text-lg font-medium text-gray-700 dark:text-gray-200">
                    {chat.title}
                  </p>
                  <span className="shrink-0 text-xs text-gray-400 sm:ml-2">
                    {formatDistanceToNow(new Date(chat.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 break-words text-sm text-gray-500 dark:text-gray-400">
                  {messageCount} message{messageCount !== 1 ? "s" : ""}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingChat({ id: chat.id, title: chat.title });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
      <DeleteChatDialog
        isOpen={!!deletingChat}
        chatTitle={deletingChat?.title || ""}
        onClose={() => setDeletingChat(null)}
        onConfirm={confirmDelete}
        isDeleting={deleteChat.isPending}
      />
    </>
  );
});
