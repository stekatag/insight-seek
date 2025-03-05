"use client";

import { GitHubLogoIcon } from "@radix-ui/react-icons";
import useProject from "@/hooks/use-project";
import Link from "next/link";
import { ExternalLink, Settings } from "lucide-react";
import CommitLog from "./commit-log";
import AskQuestionCard from "./ask-question-card";
import MeetingCard from "./meeting-card";
import DeleteProjectButton from "./delete-project-button";
import OnboardingView from "./onboarding-view";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
          {/* Project Header */}
          <div className="mb-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              {/* Project Title */}
              <div>
                <h1 className="mb-3 text-2xl font-bold tracking-tight">
                  {project.name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 gap-y-1 text-sm text-muted-foreground">
                  <Link
                    href={project.githubUrl ?? ""}
                    className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 sm:flex-row sm:items-center"
                    target="_blank"
                    title={project.githubUrl}
                  >
                    <GitHubLogoIcon className="h-5 w-5 sm:h-4 sm:w-4" />
                    <div className="flex flex-col gap-1 text-sm sm:flex-row">
                      <span>This project is linked to</span>
                      <span className="border-primary/50 sm:border-b">
                        {project.githubUrl}
                      </span>
                    </div>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Project Actions */}
              <div className="flex items-center gap-2 lg:self-end">
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
                        <GitHubLogoIcon className="mr-2 h-4 w-4" />
                        <span>View on GitHub</span>
                        <ExternalLink className="ml-1 h-3 w-3" />
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
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
          <div className="space-y-2">
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-5 w-44" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
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
