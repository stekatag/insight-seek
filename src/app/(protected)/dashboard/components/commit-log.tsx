"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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

export default function CommitLog() {
  const { projectId, project } = useProject();

  // Check if this is a newly created project from localStorage
  const isNewProject = useMemo(() => {
    const lastCreatedProject = localStorage.getItem("lastCreatedProject");
    const isNew = lastCreatedProject === projectId;

    // If this is a new project, we should preserve this information
    if (isNew) {
      // Create a session flag to remember this is a new project even after localStorage is cleared
      sessionStorage.setItem("currentProjectIsNew", "true");
    }

    // Check both localStorage and sessionStorage
    return isNew || sessionStorage.getItem("currentProjectIsNew") === "true";
  }, [projectId]);

  const [hasPendingSummaries, setHasPendingSummaries] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [isReindexing, setIsReindexing] = useState(false);
  const globalRefetch = useRefetch();

  // Add a ref to track if a refresh is already in progress to prevent duplicate requests
  const refreshInProgressRef = useRef(false);

  // Track how many refetches we've done for this commit refresh
  const refetchCountRef = useRef(0);

  // Calculate dynamic refetch interval based on pending summaries
  const refetchInterval = hasPendingSummaries
    ? 5000 // 5 seconds if there are pending summaries (faster)
    : 180000; // 3 minutes for regular updates

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
      staleTime: hasPendingSummaries ? 1000 : 60000,
      refetchOnWindowFocus: true, // Add this to refetch when the window regains focus
      refetchOnMount: true, // Always refetch when component mounts
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

  // Process commits mutation - centralized in the commit router
  const processCommitsMutation = api.commit.processCommits.useMutation({
    onSuccess: async (result) => {
      toast.success("Refreshing commits...");

      try {
        // Check if project creation is already in progress - if so, skip this request
        const projectCreationInProgress =
          localStorage.getItem("projectCreationInProgress") === "true";
        if (projectCreationInProgress) {
          // Still clear the flag to ensure proper state
          localStorage.removeItem("projectCreationInProgress");

          // Don't send another request, just refresh UI
          refreshInProgressRef.current = false;
          refetch({ throwOnError: false });
          return;
        }

        // Reset refetch counter at the start of a new refresh cycle
        refetchCountRef.current = 0;

        // Make the direct fetch to the background function from the client side
        await fetch("/api/process-commits", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: result.data.projectId,
            githubUrl: result.data.githubUrl,
            isProjectCreation: isNewProject ? true : false,
          }),
        });

        // First immediate refetch to check for any existing commits
        refetch({ throwOnError: false });
        refetchCountRef.current++;

        // Set a longer timeout for a second refetch to ensure we get all the new commits
        // This longer delay gives the background process enough time to create the commits
        setTimeout(() => {
          if (refetchCountRef.current < 3) {
            refetch({ throwOnError: false });
            refetchCountRef.current++;
            setLastRefreshTime(Date.now());
          }
          refreshInProgressRef.current = false; // Reset refresh flag when done
        }, 4000);
      } catch (error) {
        console.error("Error calling background function:", error);
        refetch();
        refreshInProgressRef.current = false; // Reset refresh flag on error too
      }
    },
    onError: (error) => {
      toast.error("Failed to refresh commits: " + error.message);
      refreshInProgressRef.current = false; // Reset refresh flag on error
    },
  });

  // Handle refresh button click
  const handleRefreshCommits = () => {
    if (!projectId || !project?.githubUrl || refreshInProgressRef.current)
      return;

    refreshInProgressRef.current = true; // Set the flag to prevent duplicate requests

    // Initial refetch to get latest data
    refetch({ throwOnError: false });

    // Safety timeout to reset the flag in case something goes wrong
    setTimeout(() => {
      refreshInProgressRef.current = false;
    }, 20000); // 20 seconds max timeout to account for longer processing

    processCommitsMutation.mutate({
      projectId,
      githubUrl: project.githubUrl,
    });
  };

  // Check if we need to load commits initially or refresh them
  useEffect(() => {
    // Only proceed if we have project details
    if (!projectId || !project?.githubUrl) return;

    // Don't start another refresh if one is already in progress
    if (refreshInProgressRef.current) return;

    // If project creation is in progress, we'll skip automatic refresh and let the background
    // function handle it - this prevents multiple refreshes
    const projectCreationInProgress =
      localStorage.getItem("projectCreationInProgress") === "true";
    if (projectCreationInProgress) {
      // Clear the flag after we've detected it
      localStorage.removeItem("projectCreationInProgress");
      return;
    }

    // If this is a new project, we should always refresh commits
    if (isNewProject) {
      handleRefreshCommits();
      return;
    }

    // For existing projects, only refresh if we have no commits or it's been a while
    const needsRefresh =
      !commits ||
      commits.length === 0 ||
      Date.now() - lastRefreshTime > 10 * 60 * 1000;

    if (needsRefresh) {
      handleRefreshCommits();
    }
  }, [projectId, project?.githubUrl, isNewProject, commits, lastRefreshTime]);

  // Check for pending summaries and update state
  useEffect(() => {
    if (commits && commits.length > 0) {
      // Reset the refresh flag when commits data is loaded
      refreshInProgressRef.current = false;

      const pending = commits.some(
        (commit) => commit.summary === "Analyzing commit...",
      );

      // Only update state if it's changed to avoid unnecessary rerenders
      if (pending !== hasPendingSummaries) {
        setHasPendingSummaries(pending);

        // If there were pending summaries but now they're all done, do a forced refetch,
        // but only if we haven't already done too many refetches
        if (!pending && hasPendingSummaries && refetchCountRef.current < 3) {
          refetchCountRef.current++;
          refetch();
        }
      }
    }
  }, [commits, hasPendingSummaries, refetch]);

  // Clear the session flag after the first commit refresh
  useEffect(() => {
    if (
      commits &&
      commits.length > 0 &&
      sessionStorage.getItem("currentProjectIsNew") === "true"
    ) {
      sessionStorage.removeItem("currentProjectIsNew");
    }
  }, [commits]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Reset refresh state when component unmounts
      refreshInProgressRef.current = false;
      refetchCountRef.current = 0;
      localStorage.removeItem("projectCreationInProgress");
      sessionStorage.removeItem("currentProjectIsNew");
    };
  }, []);

  // New mutation for confirming reindexing
  const confirmReindexMutation = api.commit.confirmReindex.useMutation({
    onSuccess: async (result) => {
      toast.success("Starting reindexing process...");
      setIsReindexing(true);

      try {
        // Call the background function to actually perform the reindexing
        const response = await fetch("/api/reindex-commits", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: result.data.projectId,
            githubUrl: result.data.githubUrl,
            commitIds: result.data.commitIds,
          }),
        });

        // Check if the request was successful
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Set a timer to check status periodically
        const checkInterval = setInterval(async () => {
          try {
            const { data } = await refetch();
            // If no more commits need reindexing, stop checking
            if (!data?.reindexMetadata?.commitCount) {
              clearInterval(checkInterval);
              setIsReindexing(false);
              toast.success("Reindexing completed successfully!");

              // Trigger global refetch to update credits
              globalRefetch();
            }
          } catch (error) {
            console.error("Error checking reindex status:", error);
            clearInterval(checkInterval);
            setIsReindexing(false);
            toast.error("Error checking reindex status");
          }
        }, 5000);

        // Safety cleanup after 10 minutes
        setTimeout(
          () => {
            clearInterval(checkInterval);
            if (isReindexing) {
              setIsReindexing(false);
              refetch();
              globalRefetch();
              toast.info("Reindexing timed out. Please check the status.");
            }
          },
          10 * 60 * 1000,
        );
      } catch (error) {
        console.error("Error calling reindex function:", error);
        setIsReindexing(false);
        toast.error("Failed to start reindexing process.");
        refetch();
      }
    },
    onError: (error) => {
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
          We couldn't find any commits for this project. Try refreshing or check
          your repository URL.
        </p>
        <Button
          onClick={handleRefreshCommits}
          disabled={refreshInProgressRef.current}
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
            disabled={refreshInProgressRef.current}
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
