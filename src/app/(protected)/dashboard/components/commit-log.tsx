"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Sparkles } from "lucide-react";

import { api } from "@/trpc/react";
import {
  cn,
  formatCodeFragments,
  formatTechnicalText,
  TRUNCATION_LIMITS,
} from "@/lib/utils";
import useProject from "@/hooks/use-project";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export default function CommitLog() {
  const { projectId, project } = useProject();
  const [hasPendingSummaries, setHasPendingSummaries] = useState(false);

  // Calculate dynamic refetch interval based on pending summaries
  const refetchInterval = hasPendingSummaries
    ? 10000 // 10 seconds if there are pending summaries
    : 180000; // 3 minutes for regular updates

  const {
    data: commits,
    refetch,
    isLoading,
  } = api.commit.getCommits.useQuery(
    { projectId },
    {
      enabled: !!projectId,
      refetchInterval,
    },
  );

  // Check for pending summaries and update state
  useEffect(() => {
    if (commits && commits.length > 0) {
      const pending = commits.some(
        (commit) => commit.summary === "Analyzing commit...",
      );
      setHasPendingSummaries(pending);

      // If there were pending summaries but now they're all done,
      // trigger one final refetch to ensure we have the latest data
      if (!pending && hasPendingSummaries) {
        setTimeout(() => {
          refetch();
        }, 1000);
      }
    }
  }, [commits, hasPendingSummaries, refetch]);

  // Refetch when component mounts to ensure we have the latest data
  useEffect(() => {
    if (projectId) {
      refetch();
    }
  }, [projectId, refetch]);

  // Return null if no project or explicitly no commits
  if (!projectId || (commits && commits.length === 0)) return null;

  // Show loading state
  if (isLoading || !commits) {
    return <CommitLogSkeleton />;
  }

  return (
    <>
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <h2 className="text-xl font-semibold">Recent Commits</h2>
        <Link
          href={`${project?.githubUrl}/commits`}
          target="_blank"
          className="text-sm text-muted-foreground hover:text-primary hover:underline"
        >
          View all on GitHub <ExternalLink className="ml-1 inline h-3 w-3" />
        </Link>
      </div>
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
