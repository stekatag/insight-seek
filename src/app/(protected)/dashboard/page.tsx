"use client";

import { GitHubLogoIcon } from "@radix-ui/react-icons";
import useProject from "@/hooks/use-project";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import CommitLog from "./commit-log";
import AskQuestionCard from "./ask-question-card";
import MeetingCard from "./meeting-card";
import DeleteProjectButton from "./delete-project-button";
import OnboardingView from "./onboarding-view";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { project, isLoading } = useProject();
  const hasProject = !!project;

  // Show loading state
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {!hasProject ? (
        <OnboardingView />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-y-4">
            {/* GitHub Repo Link */}
            <div className="w-fit rounded-md bg-primary px-4 py-3">
              <div className="flex items-center">
                <GitHubLogoIcon className="size-5 text-white" />
                <div className="ml-2">
                  <p className="text-sm font-medium text-white">
                    This project is linked to{" "}
                    <Link
                      href={project.githubUrl ?? ""}
                      className="inline-flex items-center text-white/80 hover:underline"
                      target="_blank"
                    >
                      {project.githubUrl}
                      <ExternalLink className="ml-1 size-4" />
                    </Link>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <DeleteProjectButton />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <AskQuestionCard />
            <MeetingCard />
          </div>

          <CommitLog />
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-12 w-72" />
          <div className="flex items-center space-x-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>

        {/* Banner skeleton */}
        <div className="rounded-lg border p-6">
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
            <div className="w-full space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <Skeleton className="h-64 sm:col-span-3" />
        <Skeleton className="h-64 sm:col-span-2" />
      </div>

      {/* Commit log skeleton */}
      <div className="space-y-6">
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
