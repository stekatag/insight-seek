"use client";

import { Button } from "@/components/ui/button";
import useProject from "@/hooks/use-project";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProjectSelectorProps {
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
  showCard?: boolean;
}

export function ProjectSelector({
  title = "Select a Project",
  description = "Choose an existing project or create a new one",
  compact = false,
  className = "",
  showCard = true,
}: ProjectSelectorProps) {
  const { projects, projectId, setProjectId, isLoading } = useProject();
  const router = useRouter();

  // If still loading projects data
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const hasProjects = projects && projects.length > 0;

  const handleProjectChange = (value: string) => {
    setProjectId(value);
    router.push("/dashboard");
  };

  const ProjectSelectorContent = (
    <div className={`space-y-4 ${className}`}>
      {hasProjects && (
        <div className={compact ? "space-y-2" : "space-y-4"}>
          <div className={compact ? "" : "space-y-1.5"}>
            {!compact && (
              <h3 className="text-base font-medium">Your projects</h3>
            )}
            <Select value={projectId} onValueChange={handleProjectChange}>
              <SelectTrigger className={compact ? "h-9" : ""}>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center">
            <div className="mb-2 flex-grow text-sm text-muted-foreground">
              <span className={`${compact ? "uppercase tracking-widest" : ""}`}>
                {compact ? "or" : "Or create a new project"}
              </span>
            </div>
          </div>
        </div>
      )}

      <Link href="/create" className="w-auto">
        <Button>
          <Plus className="h-4 w-4" />
          {hasProjects ? "New Project" : "Create First Project"}
        </Button>
      </Link>
    </div>
  );

  // If showCard is false, just return the selector content
  if (!showCard) {
    return ProjectSelectorContent;
  }

  // Otherwise, wrap in a card
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{ProjectSelectorContent}</CardContent>
    </Card>
  );
}
