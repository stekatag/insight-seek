"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { readStreamableValue } from "ai/rsc";
import { toast } from "sonner";

import { adaptDatabaseQuestions, Chat } from "@/types/chat";
import { api } from "@/trpc/react";
import useProject from "@/hooks/use-project";
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

function QAContent() {
  const { project, projectId } = useProject();
  const hasProject = !!project;
  const messagesEndRef = useRef<HTMLDivElement>(null); // No longer nullable
  const searchParams = useSearchParams();
  const { state, openDialog, addFollowUpOptimistically } = useChatContext();

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

  // Update the chat lookup when chats change
  useEffect(() => {
    if (!chats) return;

    chatLookup.current.clear();
    chats.forEach((chat) => {
      // Convert database chat to Chat type using chatFromDatabase helper
      const adaptedChat: Chat = {
        ...chat,
        questions: adaptDatabaseQuestions(chat.questions).map((q) => ({
          ...q,
          answerLoading: false,
        })),
      };
      chatLookup.current.set(chat.id, adaptedChat);
    });
  }, [chats]);

  // Open chat from URL if needed
  useEffect(() => {
    if (!chats || isLoading) return;

    const chatId = searchParams.get("chat");
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
  const apiUtils = api.useUtils();

  // Simplified follow-up submission handler without streaming
  const submitFollowUpQuestion = useCallback(
    async (question: string) => {
      if (!project?.id || !question.trim()) return;

      try {
        const { activeChat } = state;
        if (!activeChat) return;

        // First check if this question is already being processed or answered
        const isQuestionAlreadyProcessed = activeChat.questions.some(
          (q) => q.question === question,
        );

        const isQuestionAlreadyInProgress = activeChat.questions.some(
          (q) => q.question === question && q.answer === "Getting answer...",
        );

        if (isQuestionAlreadyProcessed && !isQuestionAlreadyInProgress) {
          console.log("Question already answered");
          return;
        }

        if (isQuestionAlreadyInProgress) {
          console.log("Question already being processed");
          return;
        }

        // Add optimistic update immediately
        addFollowUpOptimistically(question, "Getting answer...", []);

        try {
          // Fetch complete answer without streaming updates
          const { output, filesReferences = [] } = await askQuestion(
            question,
            project.id,
          );

          // Collect full answer without UI updates
          let fullAnswer = "";
          for await (const delta of readStreamableValue(output)) {
            if (delta) {
              fullAnswer += delta;
            }
          }

          // Update UI once with the complete answer
          addFollowUpOptimistically(question, fullAnswer, filesReferences);

          // Save to database in background
          await addFollowupQuestion.mutateAsync({
            chatId: activeChat.id,
            question,
            answer: fullAnswer,
            filesReferences,
          });

          // Refresh chat data
          await apiUtils.qa.getChats.invalidate({ projectId });
        } catch (error) {
          console.error("Failed to save follow-up:", error);
          toast.error("Failed to save follow-up question to database");
        }
      } catch (error) {
        console.error("Failed to process follow-up:", error);
        toast.error("Failed to get answer to follow-up question");
      }
    },
    [
      project?.id,
      state, // Add missing dependency here
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

      {!chats?.length ? (
        <NoQuestionsEmptyState />
      ) : (
        <ChatList chats={chats} variant="default" />
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
