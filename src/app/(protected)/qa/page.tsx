"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readStreamableValue } from "@ai-sdk/rsc";
import { toast } from "sonner";

import { adaptDatabaseQuestions, Chat } from "@/types/chat";
import { api } from "@/trpc/react";
import useProject from "@/hooks/use-project";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import AskQuestionCard from "@/components/chat/ask-question-card";
import { ChatProvider, useChatContext } from "@/components/chat/chat-context";
import ChatDialog from "@/components/chat/chat-dialog";
import ChatList from "@/components/chat/chat-list";
import {
  NoProjectEmptyState,
  NoQuestionsEmptyState,
} from "@/components/empty-states";
import GitBranchName from "@/components/git-branch-name";
import { ProjectSelector } from "@/components/project-selector";
import { askQuestion } from "@/app/(protected)/dashboard/actions";

// Define items per page
const ITEMS_PER_PAGE = 10;

function QAContent() {
  const { project, projectId } = useProject();
  const hasProject = !!project;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state, openDialog, addFollowUpOptimistically } = useChatContext();
  const apiUtils = api.useUtils();

  // Initialize page from URL or default to 1
  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams?.get("page");
    return pageParam ? parseInt(pageParam, 10) : 1;
  });

  // Efficiently store chat lookup with proper typing
  const chatLookup = useRef<Map<string, Chat>>(new Map());

  // Fetch chats for the current project
  const { data: chats, isLoading } = api.qa.getChats.useQuery(
    { projectId },
    {
      enabled: hasProject,
      staleTime: 0,
    },
  );

  // Make sure we only show codebase chats (no meetingId)
  const codebaseChats = useMemo(() => {
    if (!chats) return [];
    // Simple filter is sufficient now
    return chats.filter((chat) => !chat.meetingId);
  }, [chats]);

  // Paginate the chats
  const paginatedChats = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return codebaseChats.slice(startIndex, endIndex);
  }, [codebaseChats, currentPage]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(codebaseChats.length / ITEMS_PER_PAGE);
  }, [codebaseChats.length]);

  // Update the chat lookup to only include codebase chats
  useEffect(() => {
    if (!chats) return;

    chatLookup.current.clear();
    chats.forEach((chat) => {
      // Only process chats without a meetingId
      if (!chat.meetingId) {
        const adaptedChat: Chat = {
          ...chat,
          questions: adaptDatabaseQuestions(chat.questions).map((q) => ({
            ...q,
            answerLoading: false,
          })),
        };
        chatLookup.current.set(chat.id, adaptedChat);
      }
    });
  }, [chats]);

  // Open chat from URL if needed
  useEffect(() => {
    if (!chats || isLoading) return;

    const chatId = searchParams?.get("chat");
    if (chatId) {
      // Use optimized lookup for better performance
      const chat =
        chatLookup.current.get(chatId) || chats.find((c) => c.id === chatId);

      if (chat) {
        // Ensure dialog opens smoothly with full content - now with proper typing
        requestAnimationFrame(() => {
          // Convert database questions to chat-compatible questions
          const chatToOpen: Chat = {
            ...chat,
            questions: adaptDatabaseQuestions(chat.questions).map((q) => ({
              ...q,
              answerLoading: false,
            })),
          };
          openDialog(chatToOpen);
        });
      }
    }
  }, [chats, isLoading, searchParams, openDialog]);

  // API mutations
  const addFollowupQuestion = api.qa.addFollowupQuestion.useMutation();
  const createChat = api.qa.createChat.useMutation();

  // Create a function to update page with URL
  const updatePage = useCallback(
    (page: number) => {
      setCurrentPage(page);

      // Update URL without full navigation
      const params = new URLSearchParams(searchParams?.toString());
      params.set("page", page.toString());
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Create function to generate page links
  const renderPaginationItems = () => {
    const items = [];

    // For small number of pages, show all
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                updatePage(i);
              }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>,
        );
      }
      return items;
    }

    // For larger numbers, use a simpler approach
    items.push(
      <PaginationItem key={1}>
        <PaginationLink
          href="#"
          onClick={(e) => {
            e.preventDefault();
            updatePage(1);
          }}
          isActive={currentPage === 1}
        >
          1
        </PaginationLink>
      </PaginationItem>,
    );

    // Add ellipsis if not showing page 2
    if (currentPage > 3) {
      items.push(
        <PaginationItem key="ellipsis-start">
          <PaginationEllipsis />
        </PaginationItem>,
      );
    }

    // Show current page and neighbors
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              updatePage(i);
            }}
            isActive={currentPage === i}
          >
            {i}
          </PaginationLink>
        </PaginationItem>,
      );
    }

    // Add ellipsis if not showing second-to-last page
    if (currentPage < totalPages - 2) {
      items.push(
        <PaginationItem key="ellipsis-end">
          <PaginationEllipsis />
        </PaginationItem>,
      );
    }

    // Add last page
    items.push(
      <PaginationItem key={totalPages}>
        <PaginationLink
          href="#"
          onClick={(e) => {
            e.preventDefault();
            updatePage(totalPages);
          }}
          isActive={currentPage === totalPages}
        >
          {totalPages}
        </PaginationLink>
      </PaginationItem>,
    );

    return items;
  };

  // The followup submission handler
  const submitFollowUpQuestion = useCallback(
    async (question: string) => {
      if (!project?.id || !question.trim()) return;

      try {
        const { activeChat } = state;
        if (!activeChat) return;

        // Add optimistic update
        addFollowUpOptimistically(question, "Getting answer...", []);

        // Get complete answer without streaming updates
        const { output, filesReferences } = await askQuestion(
          question,
          project.id,
        );

        // Collect full answer
        let fullAnswer = "";
        for await (const delta of readStreamableValue(output)) {
          if (delta) {
            fullAnswer += delta;
          }
        }

        // Update UI once with the complete answer
        addFollowUpOptimistically(question, fullAnswer, filesReferences);

        // Save to database
        await addFollowupQuestion.mutateAsync({
          chatId: activeChat.id,
          question,
          answer: fullAnswer,
          filesReferences,
        });

        // Refresh data
        await apiUtils.qa.getChats.invalidate({ projectId });
      } catch (error) {
        console.error("Failed to process follow-up:", error);
        toast.error("Failed to get answer to follow-up question");
      }
    },
    [
      project?.id,
      state,
      addFollowUpOptimistically,
      addFollowupQuestion,
      apiUtils.qa.getChats,
      projectId,
    ],
  );

  // Show empty state when no project exists
  if (!hasProject) {
    return (
      <div className="space-y-6">
        <NoProjectEmptyState type="questions" />
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <>
      <ProjectSelector className="mb-4" />

      {/* Use the reusable AskQuestionCard component */}
      <AskQuestionCard
        context="project"
        contextId={projectId}
        askAction={async (question, quote, contextId) => {
          return askQuestion(question, contextId);
        }}
        createChatMutation={async (data) => {
          return createChat.mutateAsync({
            projectId: data.projectId,
            question: data.question,
            answer: data.answer,
            filesReferences: data.filesReferences || [],
          });
        }}
        invalidateQueries={async () => {
          return apiUtils.qa.getChats.invalidate({ projectId });
        }}
      />

      <h2 className="mb-2 mt-6 text-xl font-semibold">
        Saved Chats for {project?.name}
      </h2>
      <GitBranchName className="mb-4" />

      {!codebaseChats?.length ? (
        <NoQuestionsEmptyState />
      ) : (
        <>
          <ChatList chats={paginatedChats} variant="default" />

          {/* Add pagination if there are enough chats */}
          {totalPages > 1 && (
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) {
                        updatePage(currentPage - 1);
                      }
                    }}
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-50" : ""
                    }
                  />
                </PaginationItem>

                {renderPaginationItems()}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) {
                        updatePage(currentPage + 1);
                      }
                    }}
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

      <ChatDialog
        messagesEndRef={messagesEndRef}
        onFollowUpSubmit={submitFollowUpQuestion}
      />
    </>
  );
}

// Wrap the whole component with the ChatProvider
function QAContentWithProvider() {
  return (
    <ChatProvider>
      <QAContent />
    </ChatProvider>
  );
}

// Main QA page component that properly wraps content with Suspense
export default function QAPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      }
    >
      <QAContentWithProvider />
    </Suspense>
  );
}
