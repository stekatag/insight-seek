"use client";

import { GitHubLogoIcon } from "@radix-ui/react-icons";

import useProject from "@/hooks/use-project";

export default function DashboardPage() {
  const { project } = useProject();

  return (
    <div>
      <div className="flex-items-center flex-wrap justify-between gap-y-4">
        <div className="w-fit rounded-md bg-primary px-4 py-3">
          <GitHubLogoIcon className="size-5 text-white" />
        </div>
      </div>
    </div>
  );
}
