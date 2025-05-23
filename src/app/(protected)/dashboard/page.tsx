"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { readStreamableValue } from "ai/rsc";
import { ExternalLink, FolderKanban, Settings } from "lucide-react";
import { toast } from "sonner";

import { adaptDatabaseQuestions, Chat } from "@/types/chat";
import { api } from "@/trpc/react";
import useProject from "@/hooks/use-project";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import AskQuestionCard from "@/components/chat/ask-question-card";
import { ChatProvider, useChatContext } from "@/components/chat/chat-context";
import ChatDialog from "@/components/chat/chat-dialog";
import GitBranchName from "@/components/git-branch-name";
import MeetingCard from "@/components/meeting-card";
import { ProjectSelector } from "@/components/project-selector";

import { askQuestion } from "./actions";
import CommitLog from "./components/commit-log";
import DeleteProjectButton from "./components/delete-project-button";
import OnboardingView from "./components/onboarding-view";
import ProjectUrl from "./components/project-url";

function DashboardContent() {
  const searchParams = useSearchParams();
  const { project, projectId, isLoading: projectLoading } = useProject();
  const hasProject = !!project;
  const apiUtils = api.useUtils();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get methods from context
  const { state, openDialog, addFollowUpOptimistically } = useChatContext();

  // Initialize indexing state
  const [indexingProject, setIndexingProject] = useState<string | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<{
    hasSourceCodeEmbeddings: boolean;
    embeddingsCount: number;
    isFullyIndexed: boolean;
  } | null>(null);

  // Fetch chats for the current project
  const { data: chats, isLoading } = api.qa.getChats.useQuery(
    { projectId },
    {
      enabled: hasProject,
      staleTime: 0,
    },
  );

  // Check for newly created project in localStorage
  useEffect(() => {
    if (!hasProject) return;

    const lastCreatedProject = localStorage.getItem("lastCreatedProject");

    // If this is a newly created project, set it for indexing
    if (lastCreatedProject && lastCreatedProject === projectId) {
      setIndexingProject(projectId);
      // Scroll to top for newly created projects
      window.scrollTo(0, 0);
    }
  }, [projectId, hasProject]);

  // Fetch indexing status if we have a new project
  useEffect(() => {
    if (!indexingProject) return;

    // Create a function to poll the indexing status
    const checkIndexingStatus = async () => {
      try {
        const response = await fetch(
          `/api/project-status?projectId=${indexingProject}`,
        );

        if (!response.ok) {
          // If we get an error, stop polling
          setIndexingProject(null);
          return;
        }

        const data = await response.json();
        setIndexingStatus(data.status);

        // If the project is fully indexed, stop polling
        if (data.status.isFullyIndexed) {
          setIndexingProject(null);

          // Clear the lastCreatedProject from localStorage once indexing is complete
          if (localStorage.getItem("lastCreatedProject") === indexingProject) {
            localStorage.removeItem("lastCreatedProject");
          }

          // Show success message
          toast.success("Project indexing completed successfully!");
        }
      } catch (error) {
        console.error("Failed to check indexing status:", error);
        setIndexingProject(null);
      }
    };

    // Check immediately, then start polling
    void checkIndexingStatus();
    const interval = setInterval(checkIndexingStatus, 5000); // Check every 5 seconds

    // Clean up the interval
    return () => clearInterval(interval);
  }, [indexingProject]);

  // Initialize addFollowupQuestion mutation
  const addFollowupQuestion = api.qa.addFollowupQuestion.useMutation();
  const createChat = api.qa.createChat.useMutation();

  // Check for chat ID in URL on initial load
  useEffect(() => {
    if (!chats || isLoading) return;

    const chatId = searchParams?.get("chat");
    if (chatId) {
      const chat = chats.find((c) => c.id === chatId);
      if (chat) {
        // Open dialog with content ready to display - now with proper typing
        const chatToOpen: Chat = {
          ...chat,
          questions: adaptDatabaseQuestions(chat.questions).map((q) => ({
            ...q,
            answerLoading: false,
          })),
        };
        openDialog(chatToOpen);
      }
    }
  }, [chats, isLoading, searchParams, openDialog]);

  // The followup submission handler specific to Dashboard page
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
      state, // Add missing dependency here
      addFollowupQuestion,
      apiUtils.qa.getChats,
      projectId,
      addFollowUpOptimistically,
    ],
  );

  // Show loading state
  if (projectLoading || isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Project indexing notification */}
      {indexingProject && indexingStatus && (
        <Alert variant="info">
          <Spinner size="small" className="text-blue-500 dark:text-blue-400" />
          <AlertTitle>Project Indexing in Progress</AlertTitle>
          <AlertDescription>
            We're analyzing your project's source code. This might take a few
            minutes.
            {indexingStatus.embeddingsCount > 0 && (
              <p className="mt-1 text-sm">
                {indexingStatus.embeddingsCount} files have been processed so
                far.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <ChatDialog
        messagesEndRef={messagesEndRef}
        onFollowUpSubmit={submitFollowUpQuestion}
      />

      {!hasProject ? (
        <OnboardingView />
      ) : (
        <>
          {/* Project Header */}
          <div className="mb-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center justify-between">
                  <h1 className="mb-2 text-2xl font-bold tracking-tight">
                    {project.name}
                  </h1>

                  {/* Project Selector - visible on mobile */}
                  <div className="lg:hidden">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/projects">
                        <FolderKanban className="mr-1.5 h-4 w-4" />
                        <span>Projects</span>
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Branch display with icon */}
                <GitBranchName className="mb-4" />

                <ProjectUrl project={project} />
              </div>

              {/* Project Actions */}
              <div className="flex items-center gap-2 lg:self-end">
                {/* Project Selector - visible on desktop */}
                <div className="hidden lg:block w-64">
                  <ProjectSelector />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="mr-1.5 h-4 w-4" />
                      <span>Project Settings</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link
                        href={project.githubUrl}
                        target="_blank"
                        className="flex w-full cursor-pointer items-center"
                      >
                        <GitHubLogoIcon className="h-4 w-4" />
                        <span>View on GitHub</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
                      <DeleteProjectButton minimal />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Mobile Project Selector - full width, above cards */}
          <div className="mb-4 block lg:hidden">
            <ProjectSelector />
          </div>

          <div className="grid grid-cols-1 gap-y-4 md:gap-x-4 lg:grid-cols-5">
            {/* Use the reusable AskQuestionCard component */}
            <div className="sm:col-span-3">
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
            </div>
            <div className="sm:col-span-2">
              <MeetingCard />
            </div>
          </div>

          <CommitLog />
        </>
      )}
    </div>
  );
}

// Wrap with ChatProvider
function DashboardContentWithProvider() {
  return (
    <ChatProvider>
      <DashboardContent />
    </ChatProvider>
  );
}

// Main dashboard page component that properly wraps content with Suspense
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <DashboardSkeleton />
        </div>
      }
    >
      <DashboardContentWithProvider />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton - updated to include branch skeleton */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-5 w-32" /> {/* Branch skeleton */}
            <Skeleton className="h-5 w-44" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-y-4 md:gap-x-4 lg:grid-cols-5">
        <Skeleton className="h-64 sm:col-span-3" />
        <Skeleton className="h-64 sm:col-span-2" />
      </div>

      {/* Commit log skeleton */}
      <div className="space-y-6">
        <Skeleton className="h-8 w-44" />

        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex w-full flex-col gap-2 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-5 w-full max-w-96" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
