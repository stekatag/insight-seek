import Link from "next/link";
import { Project } from "@prisma/client";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import {
  Calendar,
  Check,
  ExternalLink,
  GitBranch,
  MoreVertical,
} from "lucide-react";

import { formatTechnicalText } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DeleteProjectButton from "@/app/(protected)/dashboard/components/delete-project-button";

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  isSelected?: boolean;
}

export default function ProjectCard({
  project,
  onClick,
  isSelected = false,
}: ProjectCardProps) {
  // Format the creation date
  const creationDate = new Date(project.createdAt).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );

  // Extract repo name from GitHub URL for display
  const repoName = project.githubUrl.split("/").slice(-2).join("/");

  return (
    <Card
      className={`overflow-hidden transition-all ${isSelected ? "border-primary border-2" : "hover:shadow-md"}`}
    >
      <div className="flex flex-col justify-between h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${isSelected ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}
              >
                {project.name.charAt(0).toUpperCase()}
              </div>
              <h3 className="truncate font-semibold">{project.name}</h3>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link
                    href={project.githubUrl}
                    target="_blank"
                    className="flex w-full cursor-pointer items-center"
                  >
                    <GitHubLogoIcon className="h-4 w-4" />
                    <span>View on GitHub</span>
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
                  <DeleteProjectButton
                    minimal
                    projectId={project.id}
                    projectName={project.name}
                  />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitHubLogoIcon className="h-4 w-4" />
            <span className="truncate" title={project.githubUrl}>
              {repoName}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <span className="font-mono text-xs">
              {formatTechnicalText(project.branch)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Created {creationDate}</span>
          </div>
        </CardContent>

        <CardFooter className="pt-4">
          {isSelected ? (
            <Button variant="outline" className="w-full" disabled>
              <Check className="h-4 w-4" />
              <span>Selected</span>
            </Button>
          ) : (
            <Button onClick={onClick} className="w-full">
              Select Project
            </Button>
          )}
        </CardFooter>
      </div>
    </Card>
  );
}
