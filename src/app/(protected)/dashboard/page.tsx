"use client";

import { GitHubLogoIcon } from "@radix-ui/react-icons";

import useProject from "@/hooks/use-project";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import CommitLog from "./commit-log";

export default function DashboardPage() {
  const { project } = useProject();

  return (
    <div className="space-y-6">
      {project?.id}
      <div className="flex-items-center flex-wrap justify-between gap-y-4 space-y-4">
        {/* GitHub Repo Link */}
        <div className="w-fit rounded-md bg-primary px-4 py-3">
          <div className="flex items-center">
            <GitHubLogoIcon className="size-5 text-white" />
            <div className="ml-2">
              <p className="text-sm font-medium text-white">
                This project is linked to{" "}
                <Link
                  href={project?.githubUrl ?? ""}
                  className="inline-flex items-center text-white/80 hover:underline"
                >
                  {project?.githubUrl}
                  <ExternalLink className="ml-1 size-4" />
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          TeamMembers InviteButton ArchiveButton
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        AskQuestioNCard MeetingCard
      </div>

      <CommitLog />
    </div>
  );
}
