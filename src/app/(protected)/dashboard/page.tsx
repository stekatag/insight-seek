"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { readStreamableValue } from "ai/rsc";
import { ExternalLink, FolderKanban, Settings } from "lucide-react";
import { toast } from "sonner";

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
import ChatDialog from "@/components/chat/chat-dialog";
import { chatReducer, initialChatState } from "@/components/chat/chat-reducer";
import GitBranchName from "@/components/git-branch-name";
import MeetingCard from "@/components/meeting-card";
import { ProjectSelector } from "@/components/project-selector";

import { askQuestion } from "./actions";
import CommitLog from "./components/commit-log";
import DeleteProjectButton from "./components/delete-project-button";
import OnboardingView from "./components/onboarding-view";
import ProjectUrl from "./components/project-url";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { project, projectId, isLoading: projectLoading } = useProject();
  const hasProject = !!project;
  const newProjectId = searchParams.get("newProject");

  const [indexingProject, setIndexingProject] = useState<string | null>(
    newProjectId,
  );
  const [indexingStatus, setIndexingStatus] = useState<{
    hasSourceCodeEmbeddings: boolean;
    embeddingsCount: number;
    isFullyIndexed: boolean;
  } | null>(null);

  // Simplify state by using a reducer like in AskQuestionCard
  const [chatState, chatDispatch] = useReducer(chatReducer, initialChatState);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get utils at component level
  const apiUtils = api.useUtils();

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

        // If the project is fully indexed, stop polling and clear the URL parameter
        if (data.status.isFullyIndexed) {
          setIndexingProject(null);

          // Remove the newProject parameter from URL after successful indexing
          const params = new URLSearchParams(window.location.search);
          params.delete("newProject");
          const newUrl =
            window.location.pathname +
            (params.toString() ? `?${params.toString()}` : "");
          router.replace(newUrl);

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
  }, [indexingProject, router]);

  // Check for chat in URL
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
      chatDispatch({ type: "SET_STREAM_CONTENT", payload: "" });
      chatDispatch({ type: "SET_FOLLOW_UP", payload: "" });
    }
  }, [chats, isLoading, searchParams]);

  // Handle follow-up question change
  const handleFollowUpChange = useCallback((value: string) => {
    chatDispatch({ type: "SET_FOLLOW_UP", payload: value });
  }, []);

  // Handle follow-up question submission
  const handleFollowUpSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      const { followUpQuestion, isStreaming } = chatState;

      if (
        !followUpQuestion.trim() ||
        isStreaming ||
        !activeChat ||
        !project?.id
      )
        return;

      // Set streaming state immediately
      chatDispatch({ type: "START_FOLLOW_UP_STREAMING" });

      try {
        // Get answer from AI
        const { output, filesReferences } = await askQuestion(
          followUpQuestion,
          project.id,
        );

        // Stream the answer in real-time
        let fullAnswer = "";
        for await (const delta of readStreamableValue(output)) {
          if (delta) {
            fullAnswer += delta;
            chatDispatch({ type: "SET_STREAM_CONTENT", payload: fullAnswer });
          }
        }

        // Save the follow-up question to the chat
        await addFollowupQuestion.mutateAsync({
          chatId: activeChat.id,
          question: followUpQuestion,
          answer: fullAnswer,
          filesReferences,
        });

        // Reset states
        chatDispatch({ type: "STOP_STREAMING" });
        chatDispatch({ type: "SET_FOLLOW_UP", payload: "" });

        // Refresh the chats data
        await apiUtils.qa.getChats.invalidate({ projectId });
      } catch (error) {
        console.error("Failed to process follow-up:", error);
        toast.error("Failed to get answer to follow-up question");
        chatDispatch({ type: "STOP_STREAMING" });
      }
    },
    [
      chatState,
      project?.id,
      activeChat,
      addFollowupQuestion,
      apiUtils,
      projectId,
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

      // Reset all streaming and dialog states
      chatDispatch({ type: "STOP_STREAMING" });
      chatDispatch({ type: "SET_FOLLOW_UP", payload: "" });
    }
  };

  // Show loading state
  if (projectLoading || isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Project indexing notification */}
      {indexingProject && indexingStatus && (
        <Alert className="animate-pulse bg-blue-50">
          <Spinner size="small" className="text-blue-500" />
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
        key={`chat-${activeChat?.id || "no-chat"}-${chatState.isStreaming ? "streaming" : "idle"}`}
        isOpen={isOpen && !!activeChat}
        setIsOpen={handleSetIsOpen}
        activeChat={activeChat}
        followUpQuestion={chatState.followUpQuestion}
        isStreaming={chatState.isStreaming}
        streamContent={chatState.streamContent}
        messagesEndRef={messagesEndRef}
        onFollowUpChange={handleFollowUpChange}
        onFollowUpSubmit={handleFollowUpSubmit}
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
            <AskQuestionCard />
            <MeetingCard />
          </div>

          <CommitLog />
        </>
      )}
    </div>
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
      <DashboardContent />
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
