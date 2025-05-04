"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  CreditCard,
  ExternalLink,
  FileCode,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import {
  cn,
  formatCodeFragments,
  formatTechnicalText,
  TRUNCATION_LIMITS,
} from "@/lib/utils";
import useProject from "@/hooks/use-project";
import useRefetch from "@/hooks/use-refetch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  triggerCommitProcessingAction,
  triggerReindexCommitsAction,
} from "@/app/actions/commitActions";

export default function CommitLog() {
  const { projectId, project } = useProject();
  const searchParams = useSearchParams();

  // Check if this is a newly created project from query param
  const isNewProject = useMemo(() => {
    // Check the 'new' query parameter first
    const newParam = searchParams?.get("new");
    if (newParam === "true") {
      return true;
    }
    // Fallback check using localStorage for direct refresh cases
    const lastCreatedProject = localStorage.getItem("lastCreatedProject");
    return lastCreatedProject === projectId;
  }, [projectId, searchParams]);

  const [hasPendingSummaries, setHasPendingSummaries] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const [isReindexing, setIsReindexing] = useState(false);
  const globalRefetch = useRefetch();

  // Add a ref to track if a refresh is already in progress to prevent duplicate requests
  const refreshInProgressRef = useRef(false);

  // Track how many refetches we've done for this commit refresh
  const refetchCountRef = useRef(0);

  // Calculate dynamic refetch interval based on pending summaries
  const refetchInterval = hasPendingSummaries ? 5000 : false; // Only poll actively if summaries are pending

  // Fetch commits using TRPC
  const {
    data: commitsData,
    refetch,
    isLoading,
  } = api.commit.getCommits.useQuery(
    { projectId },
    {
      enabled: !!projectId,
      refetchInterval,
      staleTime: 2500, // Keep data fresh for 2.5 seconds
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  );

  // Destructure commit data
  const commits = useMemo(
    () => commitsData?.commits || [],
    [commitsData?.commits],
  );
  const reindexMetadata = commitsData?.reindexMetadata || {
    commitCount: 0,
    fileCount: 0,
  };

  // --- Centralized Function to Trigger Refresh ---
  const triggerRefresh = useCallback(
    async (isInitialLoad = false) => {
      if (!projectId || refreshInProgressRef.current) {
        return;
      }
      refreshInProgressRef.current = true;
      toast.info(
        isInitialLoad
          ? "Starting initial commit analysis..."
          : "Checking for new commits...",
      );
      try {
        const result = await triggerCommitProcessingAction({
          projectId,
          isProjectCreation: isInitialLoad,
        });
        if (result.success) {
          toast.success("Commit check started. New data will appear shortly.");
          setLastRefreshTime(Date.now());
          setTimeout(() => {
            refetch();
            refreshInProgressRef.current = false;
          }, 3000);
        } else {
          console.error(
            `Failed to trigger commit processing for project ${projectId}:`,
            result.error,
          );
          toast.error(result.error || "Failed to start commit check.");
          refreshInProgressRef.current = false;
        }
      } catch (error) {
        console.error("Error triggering commit processing action:", error);
        toast.error("Failed to check commits due to an unexpected error.");
        refreshInProgressRef.current = false;
      }
    },
    [projectId, refetch],
  );

  // Handle refresh button click
  const handleRefreshCommits = () => {
    triggerRefresh(false);
  };

  // Initial load/refresh logic - SIMPLIFIED
  const initialCheckPerformed = useRef(false);

  useEffect(() => {
    if (!projectId || initialCheckPerformed.current) return;

    // This effect runs on mount and when projectId/isLoading/commits change.
    // We only want to perform the *initial* check logic ONCE.

    if (!isLoading && !refreshInProgressRef.current) {
      // Mark that we've performed the initial check now
      initialCheckPerformed.current = true;

      if (commits.length === 0) {
        // If loading is done and there are NO commits,
        // assume this is the first load and trigger a refresh.
        // Use the isNewProject flag derived from query param / localStorage
        triggerRefresh(isNewProject); // Pass the flag
      } else {
        // If commits *are* present on first load, we might still need to clear the localStorage flag
        // if the user navigated here via direct refresh instead of the standard flow
        if (localStorage.getItem("lastCreatedProject") === projectId) {
          localStorage.removeItem("lastCreatedProject");
        }
        // ALSO trigger a standard refresh check when commits are already loaded on mount
        triggerRefresh(false);
      }
    }
    // Cleanup: We don't need to manage the query param, it's part of the URL state.
    // The localStorage flag is handled above.
  }, [projectId, isLoading, commits, triggerRefresh, isNewProject]);

  // Check for pending summaries and update polling state
  useEffect(() => {
    const pending = commits?.some(
      (commit) => commit.summary === "Processing...",
    );
    if (pending !== hasPendingSummaries) {
      setHasPendingSummaries(!!pending);
      // If we just finished processing, trigger one final refetch immediately
      if (!pending && hasPendingSummaries) {
        // Reset refetch in progress flag before final refetch
        refreshInProgressRef.current = false;
        refetch();
      }
    }
  }, [commits, hasPendingSummaries, refetch]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Reset refresh state when component unmounts
      refreshInProgressRef.current = false;
      refetchCountRef.current = 0;
      // Don't clear projectCreationInProgress here, it's cleared on use
      // Don't clear currentProjectIsNew here, let the other effect handle it
    };
  }, []);

  // Mutation for confirming reindexing
  const confirmReindexMutation = api.commit.confirmReindex.useMutation({
    onSuccess: async (result) => {
      toast.info("Starting reindexing process...");
      setIsReindexing(true);

      try {
        // Call the new Server Action instead of tasks.trigger
        const actionResult = await triggerReindexCommitsAction({
          projectId: result.data.projectId,
          githubUrl: result.data.githubUrl,
          commitIds: result.data.commitIds,
        });

        if (actionResult.success && actionResult.runId) {
          // Keep existing polling logic using refetch to update UI
          const checkInterval = setInterval(async () => {
            try {
              const { data } = await refetch();
              if (data?.reindexMetadata?.commitCount === 0) {
                clearInterval(checkInterval);
                setIsReindexing(false);
                toast.success("Reindexing completed successfully!");
                globalRefetch();
              }
            } catch (error) {
              console.error(
                "Error checking reindex status via refetch:",
                error,
              );
              clearInterval(checkInterval);
              setIsReindexing(false);
              toast.error("Error checking reindex status");
            }
          }, 7000);

          // Safety cleanup after 15 minutes
          setTimeout(
            () => {
              clearInterval(checkInterval);
              if (isReindexing) {
                setIsReindexing(false);
                refetch();
                globalRefetch();
                toast.info(
                  "Reindexing check timed out. Please refresh manually if needed.",
                );
              }
            },
            15 * 60 * 1000,
          );
        } else {
          // Handle failure from the server action call
          throw new Error(
            actionResult.error ||
              "Failed to trigger reindexing task via server action.",
          );
        }
      } catch (error) {
        // Catch errors from calling the server action or subsequent logic
        console.error("Error in reindex confirmation flow:", error);
        setIsReindexing(false);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to start reindexing task.",
        );
        refetch(); // Refetch even on error to get latest state
      }
    },
    onError: (error) => {
      // This catches errors from the initial confirmReindex TRPC mutation
      toast.error("Failed to confirm reindexing: " + error.message);
      setIsReindexing(false);
    },
  });

  // Handle reindex confirmation
  const handleConfirmReindex = () => {
    if (!projectId || !project?.githubUrl) return;

    confirmReindexMutation.mutate({
      projectId,
      githubUrl: project.githubUrl,
    });
  };

  // Add the credits query
  const { data: creditsData, isLoading: isLoadingCredits } =
    api.user.getMyCredits.useQuery(undefined, {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
    });

  const userCredits = creditsData?.credits || 0;
  const creditsNeeded = reindexMetadata.fileCount * 2;
  const hasEnoughCredits = userCredits >= creditsNeeded;

  // Return null if no project
  if (!projectId) return null;

  // Show loading state
  if (isLoading || !commits) {
    return <CommitLogSkeleton />;
  }

  // If no commits are available, show a message and refresh button
  if (commits.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold">No Commits Found</h2>
        <p className="mb-6 text-muted-foreground">
          We couldn't find any commits for this project yet.
          {isNewProject
            ? " Initial analysis is likely in progress. The list will update automatically."
            : " Try refreshing or check your repository URL."}
        </p>
        {/* Only show refresh button if it's NOT a new project */}
        {!isNewProject && (
          <Button
            onClick={handleRefreshCommits}
            disabled={refreshInProgressRef.current || isLoading}
          >
            {refreshInProgressRef.current ? (
              <>
                <Spinner size="small" className="text-white" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh Commits
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  // Render commits list
  return (
    <>
      {/* Reindexing Alert */}
      {reindexMetadata.commitCount > 0 && !isReindexing && (
        <Alert variant="info" className="mb-4">
          <AlertTitle className="text-base font-semibold">
            Codebase Updates Available
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              There {reindexMetadata.commitCount === 1 ? "is" : "are"}{" "}
              <span className="font-medium">{reindexMetadata.commitCount}</span>{" "}
              commit
              {reindexMetadata.commitCount !== 1 && "s"} with{" "}
              <span className="font-medium">{reindexMetadata.fileCount}</span>{" "}
              modified file
              {reindexMetadata.fileCount !== 1 && "s"} that need to be reindexed
              to keep your codebase up-to-date.
            </p>
            <div className="mt-1 flex flex-col gap-2 rounded-md bg-blue-100 p-3 text-sm dark:bg-blue-900/30">
              <div className="flex items-start gap-2">
                <FileCode className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <p>
                  This will use{" "}
                  <span className="font-semibold">{creditsNeeded} credits</span>{" "}
                  (2 credits per file).
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CreditCard className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  Your current balance:{" "}
                  {isLoadingCredits ? (
                    <Spinner size="small" className="inline" />
                  ) : (
                    <span
                      className={cn(
                        "font-semibold",
                        !hasEnoughCredits && "text-red-600 dark:text-red-400",
                      )}
                    >
                      {userCredits} credits
                    </span>
                  )}
                </div>
              </div>
            </div>

            {hasEnoughCredits ? (
              <Button
                onClick={handleConfirmReindex}
                disabled={confirmReindexMutation.isPending}
                className="mt-1 self-start"
                size="sm"
                variant="secondary"
              >
                {confirmReindexMutation.isPending ? (
                  <>
                    <Spinner size="small" className="text-white" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <RefreshCw className=" h-3.5 w-3.5" />
                    Reindex Files
                  </>
                )}
              </Button>
            ) : (
              <div className="flex flex-col gap-2 mt-1">
                <p className="text-sm text-red-600 dark:text-red-400">
                  You don't have enough credits to reindex these files.
                </p>
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="self-start"
                >
                  <Link href="/billing">
                    <CreditCard className="h-3.5 w-3.5" />
                    Buy Credits
                  </Link>
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Reindexing Progress Alert */}
      {isReindexing && (
        <Alert variant="info" className="mb-4">
          <AlertTitle className="text-base font-semibold flex items-center gap-2">
            <Spinner
              size="small"
              className="text-blue-600 dark:text-blue-400"
            />
            Reindexing in Progress
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>
              We're updating your codebase with the changes from{" "}
              <span className="font-medium">{reindexMetadata.commitCount}</span>{" "}
              commit
              {reindexMetadata.commitCount !== 1 && "s"}. This might take a few
              minutes.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <h2 className="text-xl font-semibold">
          Recent Commits
          {hasPendingSummaries && (
            <span className="ml-2 text-xs text-amber-500">
              (Generating summaries...)
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshCommits}
            disabled={refreshInProgressRef.current || isLoading}
          >
            {refreshInProgressRef.current ? (
              <Spinner size="small" className="mr-1" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
          <Link
            href={`${project?.githubUrl}/commits`}
            target="_blank"
            className="text-sm text-muted-foreground hover:text-primary hover:underline"
          >
            View on GitHub <ExternalLink className="ml-1 inline h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Actual commits list */}
      <ul role="list" className="space-y-6">
        {commits.map((commit, commitIdx) => (
          <li key={commit.id} className="relative flex gap-x-2 sm:gap-x-4">
            <div
              className={cn(
                commitIdx === commits.length - 1 ? "h-6" : "-bottom-6",
                "absolute left-0 top-0 flex w-6 justify-center",
              )}
            >
              <div className="w-px translate-x-1 bg-secondary" />
            </div>

            <Image
              src={commit.commitAuthorAvatar}
              alt={commit.commitAuthorName}
              width={32}
              height={32}
              className="relative mt-3 h-8 w-8 flex-none rounded-full bg-gray-50"
            />

            <div className="flex-auto rounded-md bg-card p-3 ring-1 ring-inset ring-secondary">
              <div className="flex justify-between gap-x-4">
                <Link
                  target="_blank"
                  className="mb-2 flex flex-col gap-1 py-0.5 text-xs leading-5 dark:text-secondary-foreground/50 text-secondary-foreground/70  sm:mb-0 sm:flex-row sm:gap-2"
                  href={`${project?.githubUrl}/commit/${commit.commitHash}`}
                  title={commit.commitAuthorName}
                >
                  <span className="font-medium">{commit.commitAuthorName}</span>
                  <span className="inline-flex items-center">
                    committed
                    <ExternalLink className="ml-1 h-4 w-4" />
                  </span>
                </Link>
                <time
                  dateTime={commit.commitDate.toString()}
                  className="flex-none py-0.5 text-xs leading-5 text-muted-foreground"
                >
                  {formatDistanceToNow(commit.commitDate, {
                    addSuffix: true,
                  })}
                </time>
              </div>
              <span
                className="mb-2 block break-words font-semibold"
                title={commit.commitMessage}
              >
                {formatTechnicalText(
                  commit.commitMessage,
                  TRUNCATION_LIMITS.COMMIT_MESSAGE,
                )}
              </span>
              <span className="mb-1 flex items-center gap-1 text-xs text-primary/80 dark:text-primary">
                <Sparkles className="size-4" /> AI Commit Summary
              </span>

              {commit.summary === "Analyzing commit..." ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner size="small" />
                  <span>Generating summary...</span>
                </div>
              ) : (
                <div className="break-words text-sm leading-6 text-secondary-foreground/70 dark:text-secondary-foreground/50">
                  {formatCodeFragments(commit.summary || "Summary unavailable")}
                </div>
              )}

              {/* Show modified files indicator if needed */}
              {commit.needsReindex && commit.modifiedFiles?.length > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-amber-500">
                  <FileCode className="h-3.5 w-3.5" />
                  <span>
                    {commit.modifiedFiles.length} modified file
                    {commit.modifiedFiles.length !== 1 && "s"} need reindexing
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function CommitLogSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-5 w-32" />
      </div>

      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="relative flex w-6 justify-center">
            <div className="absolute bottom-0 top-0 w-px bg-gray-200"></div>
          </div>
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="w-full space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-5 w-full max-w-md" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
