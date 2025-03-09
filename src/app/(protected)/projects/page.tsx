"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, SearchIcon } from "lucide-react";

import useProject from "@/hooks/use-project";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/app/(protected)/projects/components/empty-state";

import ProjectCard from "./components/project-card";

export default function ProjectsPage() {
  const { projects, isLoading, setProjectId, projectId } = useProject();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState(projects || []);

  // Filter projects based on search query
  useEffect(() => {
    if (!projects) return;

    if (searchQuery.trim() === "") {
      setFilteredProjects(projects);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = projects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.githubUrl.toLowerCase().includes(query) ||
        project.branch.toLowerCase().includes(query),
    );

    setFilteredProjects(filtered);
  }, [searchQuery, projects]);

  // Sort projects by creation date (newest first)
  const sortedProjects = filteredProjects?.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage and access all your InsightSeek projects
          </p>
        </div>
        <Link href="/create">
          <Button>
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{filteredProjects.length} projects</span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : sortedProjects && sortedProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isSelected={project.id === projectId}
              onClick={() => {
                setProjectId(project.id);
                window.location.href = "/dashboard";
              }}
            />
          ))}
        </div>
      ) : searchQuery ? (
        <div className="flex h-60 flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <p className="text-muted-foreground">
            No projects matching "{searchQuery}"
          </p>
          <Button variant="outline" onClick={() => setSearchQuery("")}>
            Clear Search
          </Button>
        </div>
      ) : (
        <EmptyState
          title="No projects yet"
          description="Get started by creating your first project"
          icon="folder"
          action={
            <Link href="/create">
              <Button>
                <Plus className="mr-1.5 h-4 w-4" />
                <span>Create Project</span>
              </Button>
            </Link>
          }
        />
      )}
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-4 w-full" />
        <div className="mt-4 flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Separator className="my-4" />
        <div className="mt-2 flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </Card>
  );
}
