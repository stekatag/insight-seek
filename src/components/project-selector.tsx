"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, FolderKanban, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import useProject from "@/hooks/use-project";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";

export function ProjectSelector({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { projects, projectId, setProjectId, isLoading } = useProject();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState(projects || []);

  // Sort projects by creation date (newest first)
  const sortedProjects = projects?.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Get current project name
  const currentProject = projects?.find((p) => p.id === projectId);

  // Filter projects based on search query
  useEffect(() => {
    if (!sortedProjects) return;

    if (!searchQuery.trim()) {
      setFilteredProjects(sortedProjects);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = sortedProjects.filter(
      (project) =>
        project.name.toLowerCase().includes(query) ||
        project.githubUrl.toLowerCase().includes(query) ||
        project.branch.toLowerCase().includes(query),
    );

    setFilteredProjects(filtered);
  }, [searchQuery, sortedProjects]);

  // Determine button state
  const showButton = !isLoading && sortedProjects && sortedProjects.length > 0;

  // Handle input search change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-left",
              isLoading && "opacity-70",
            )}
            disabled={isLoading || !showButton}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Spinner size="small" />
                <span>Loading projects...</span>
              </div>
            ) : currentProject ? (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs text-primary">
                  {currentProject.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{currentProject.name}</span>
              </div>
            ) : (
              "Select a project"
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] sm:w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search projects..."
              value={searchQuery}
              onValueChange={handleSearchChange}
            />
            <CommandList>
              <CommandEmpty>
                <div className="flex flex-col items-center justify-center py-6">
                  <p className="text-sm text-muted-foreground">
                    No projects found
                  </p>
                  <div className="mt-2">
                    <Link href="/create">
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4" />
                        <span>Create Project</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              </CommandEmpty>

              <CommandGroup heading="Projects">
                {filteredProjects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.id}
                    onSelect={(currentValue) => {
                      setProjectId(currentValue);
                      setOpen(false);
                      setSearchQuery(""); // Reset search when selecting
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs text-primary">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{project.name}</span>
                    </div>
                    {project.id === projectId && (
                      <Check className="ml-2 h-4 w-4 shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    window.location.href = "/projects";
                    setOpen(false);
                  }}
                >
                  <FolderKanban className="h-4 w-4 shrink-0" />
                  <span className="flex-1">View All Projects</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    window.location.href = "/create";
                    setOpen(false);
                  }}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="flex-1">Create New Project</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
