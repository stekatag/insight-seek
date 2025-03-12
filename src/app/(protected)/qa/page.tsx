"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readStreamableValue } from "ai/rsc";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import useProject from "@/hooks/use-project";
import useRefetch from "@/hooks/use-refetch";
import AskQuestionCard from "@/components/chat/ask-question-card";
import {
  NoProjectEmptyState,
  NoQuestionsEmptyState,
} from "@/components/empty-states";
import GitBranchName from "@/components/git-branch-name";
import { ProjectSelector } from "@/components/project-selector";
import { askQuestion } from "@/app/(protected)/dashboard/actions";

import ChatDialog from "../../../components/chat/chat-dialog";
import ChatList from "./components/chat-list";

// Content component that uses useSearchParams - must be wrapped in Suspense
function QAContent() {
  const { project, projectId } = useProject();
  const hasProject = !!project;
  const refetch = useRefetch();
  const router = useRouter();
  const searchParams = useSearchParams();

  // State for managing follow-up questions
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chats for the current project
  const { data: chats, isLoading } = api.qa.getChats.useQuery(
    { projectId },
    {
      enabled: hasProject,
      staleTime: 0,
    },
  );

  const addFollowupQuestion = api.qa.addFollowupQuestion.useMutation();
  const [activeChatIndex, setActiveChatIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const activeChat = chats?.[activeChatIndex];

  // Handle URL parameter to restore chat state on page load/refresh
  useEffect(() => {
    if (!chats || chats.length === 0 || isLoading) return;

    const chatId = searchParams.get("chat");
    if (!chatId) return;

    // Find the chat with the matching ID
    const chatIndex = chats.findIndex((chat) => chat.id === chatId);
    if (chatIndex !== -1) {
      setActiveChatIndex(chatIndex);
      setIsOpen(true);
      // Reset streaming states
      setStreamContent("");
      setFollowUpQuestion("");
    }
  }, [chats, isLoading, searchParams]);

  const handleChatClick = (idx: number) => {
    setActiveChatIndex(idx);

    // Update URL with chat ID
    if (chats && chats[idx]) {
      const url = new URL(window.location.href);
      url.searchParams.set("chat", chats[idx].id);
      router.replace(url.pathname + url.search, { scroll: false });
    }

    setIsOpen(true);
    // Reset streaming states
    setStreamContent("");
    setFollowUpQuestion("");
  };

  // Handle follow-up question change
  const handleFollowUpChange = useCallback((value: string) => {
    setFollowUpQuestion(value);
  }, []);

  // Handle follow-up question submission
  const handleFollowUpSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (
        !followUpQuestion.trim() ||
        isStreaming ||
        !activeChat ||
        !project?.id
      )
        return;

      setIsStreaming(true);

      try {
        // Get answer from AI
        const { output, filesReferences } = await askQuestion(
          followUpQuestion,
          project.id,
        );

        // Start streaming the answer
        setStreamContent("");
        let fullAnswer = "";

        for await (const delta of readStreamableValue(output)) {
          if (delta) {
            fullAnswer += delta;
            setStreamContent(fullAnswer);
          }
        }

        // Save the follow-up question to the chat
        await addFollowupQuestion.mutateAsync({
          chatId: activeChat.id,
          question: followUpQuestion,
          answer: fullAnswer,
          filesReferences,
        });

        // Clear input and stream content
        setFollowUpQuestion("");
        setStreamContent("");

        // Refetch the chats to update the UI
        refetch();
      } catch (error) {
        console.error("Failed to process follow-up:", error);
        toast.error("Failed to get answer to follow-up question");
      } finally {
        setIsStreaming(false);
      }
    },
    [
      followUpQuestion,
      isStreaming,
      activeChat,
      project?.id,
      addFollowupQuestion,
      refetch,
    ],
  );

  // Handle dialog close
  const handleSetIsOpen = (newOpenState: boolean) => {
    setIsOpen(newOpenState);

    if (!newOpenState) {
      // Clean up URL when closing the dialog
      const url = new URL(window.location.href);
      if (url.searchParams.has("chat")) {
        url.searchParams.delete("chat");
        router.replace(url.pathname + url.search, { scroll: false });
      }

      // Clear states
      setStreamContent("");
      setFollowUpQuestion("");
    }
  };

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
      <AskQuestionCard />

      <h2 className="mb-2 mt-6 text-xl font-semibold">
        Saved Chats for {project?.name}
      </h2>
      <GitBranchName className="mb-4" />

      {!chats?.length ? (
        <NoQuestionsEmptyState />
      ) : (
        <ChatList chats={chats} onChatClick={handleChatClick} />
      )}

      <ChatDialog
        isOpen={isOpen && !!activeChat}
        setIsOpen={handleSetIsOpen}
        activeChat={activeChat}
        followUpQuestion={followUpQuestion}
        isStreaming={isStreaming}
        streamContent={streamContent}
        messagesEndRef={messagesEndRef}
        onFollowUpChange={handleFollowUpChange}
        onFollowUpSubmit={handleFollowUpSubmit}
      />
    </>
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
      <QAContent />
    </Suspense>
  );
}
