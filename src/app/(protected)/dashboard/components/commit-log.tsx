"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import {
  cn,
  formatCodeFragments,
  formatTechnicalText,
  TRUNCATION_LIMITS,
} from "@/lib/utils";
import useProject from "@/hooks/use-project";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export default function CommitLog() {
  const { projectId, project } = useProject();
  const [hasPendingSummaries, setHasPendingSummaries] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());

  // Calculate dynamic refetch interval based on pending summaries
  const refetchInterval = hasPendingSummaries
    ? 5000 // 5 seconds if there are pending summaries (faster)
    : 180000; // 3 minutes for regular updates

  // Fetch commits using TRPC
  const {
    data: commits,
    refetch,
    isLoading,
  } = api.commit.getCommits.useQuery(
    { projectId },
    {
      enabled: !!projectId,
      refetchInterval,
      staleTime: hasPendingSummaries ? 1000 : 60000, // Make data stale quickly when there are pending summaries
    },
  );

  // Process commits mutation - centralized in the commit router
  const processCommitsMutation = api.commit.processCommits.useMutation({
    onSuccess: () => {
      toast.success("Refreshing commits...");
      // Set a small timeout before first refetch to allow background processing to start
      setTimeout(() => {
        refetch();
        setLastRefreshTime(Date.now());
      }, 1000);
    },
    onError: (error) => {
      toast.error("Failed to refresh commits: " + error.message);
    },
  });

  // Check for pending summaries and update state
  useEffect(() => {
    if (commits && commits.length > 0) {
      const pending = commits.some(
        (commit) => commit.summary === "Analyzing commit...",
      );

      // Only update state if it's changed to avoid unnecessary rerenders
      if (pending !== hasPendingSummaries) {
        setHasPendingSummaries(pending);

        // If there were pending summaries but now they're all done, do a forced refetch
        if (!pending && hasPendingSummaries) {
          console.log("Summaries completed, doing final refetch");
          refetch();
        }
      }
    }
  }, [commits, hasPendingSummaries, refetch]);

  // Check if we need to load commits initially or refresh them
  useEffect(() => {
    const shouldCheck = projectId && project?.githubUrl;
    if (!shouldCheck) return;

    // Check if no commits or if it's been more than 10 minutes since last refresh
    const needsRefresh =
      !commits ||
      commits.length === 0 ||
      Date.now() - lastRefreshTime > 10 * 60 * 1000;

    if (needsRefresh) {
      console.log("Initial commit refresh needed");
      handleRefreshCommits();
    }
  }, [projectId, project?.githubUrl]); // Deliberately remove commits from dependencies

  // Handle refresh button click
  const handleRefreshCommits = () => {
    if (!projectId || !project?.githubUrl) return;

    processCommitsMutation.mutate({
      projectId,
      githubUrl: project.githubUrl,
    });
  };

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
          disabled={processCommitsMutation.isPending}
        >
          {processCommitsMutation.isPending ? (
            <>
              <Spinner size="small" className="mr-2" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
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
            disabled={processCommitsMutation.isPending}
          >
            {processCommitsMutation.isPending ? (
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

      {/* Actual commits list - no changes needed here */}
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
