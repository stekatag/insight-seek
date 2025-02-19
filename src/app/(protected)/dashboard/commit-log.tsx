"use client";

import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import useProject from "@/hooks/use-project";
import { formatDistanceToNow } from "date-fns";

export default function CommitLog() {
  const { projectId, project } = useProject();
  const { data: commits } = api.project.getCommits.useQuery({ projectId });
  if (!commits) return null;

  return (
    <>
      <ul role="list" className="space-y-6">
        {commits.map((commit, commitIdx) => (
          <li key={commit.id} className="relative flex gap-x-4">
            <div
              className={cn(
                commitIdx === commits.length - 1 ? "h-6" : "-bottom-6",
                "absolute left-0 top-0 flex w-6 justify-center",
              )}
            >
              <div className="w-px translate-x-1 bg-gray-200" />
            </div>

            <img
              src={commit.commitAuthorAvatar}
              alt={commit.commitAuthorName}
              className="relative mt-3 h-8 w-8 flex-none rounded-full bg-gray-50"
            />

            <div className="flex-auto rounded-md bg-white p-3 ring-1 ring-inset ring-gray-200">
              <div className="flex justify-between gap-x-4">
                <Link
                  target="_blank"
                  className="py-0.5 text-xs leading-5 text-gray-500"
                  href={`${project?.githubUrl}/commits/${commit.commitHash}`}
                >
                  <span className="font-medium text-gray-900">
                    {commit.commitAuthorName}
                  </span>{" "}
                  <span className="inline-flex items-center">
                    committed
                    <ExternalLink className="ml-1 h-4 w-4" />
                  </span>
                </Link>
                <time
                  dateTime={commit.commitDate.toString()}
                  className="flex-none py-0.5 text-xs leading-5 text-gray-500"
                >
                  {formatDistanceToNow(commit.commitDate, {
                    addSuffix: true,
                  })}
                </time>
              </div>
              <span className="mb-2 block font-semibold">
                {commit.commitMessage}
              </span>
              <span className="mb-1 flex items-center gap-1 text-xs text-primary/80">
                <Sparkles className="size-4" /> AI Commit Summary
              </span>
              <pre className="whitespace-pre-wrap text-sm leading-6 text-gray-600">
                {commit.summary}
              </pre>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
