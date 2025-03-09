import { GitBranch } from "lucide-react";

import { cn } from "@/lib/utils";
import useProject from "@/hooks/use-project";

import { Skeleton } from "./ui/skeleton";

interface GitBranchNameProps {
  className?: string;
}

export default function GitBranchName({ className }: GitBranchNameProps) {
  const { project, isLoading } = useProject();

  if (isLoading) {
    return <Skeleton className={cn("h-5 w-32", className)} />;
  }

  if (!project?.branch) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center text-sm text-muted-foreground",
        className,
      )}
    >
      <GitBranch className="mr-1.5 h-4 w-4" />
      <span className="font-medium font-mono">{project.branch}</span>
    </div>
  );
}
