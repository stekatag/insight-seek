"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { Eye, Lock, RefreshCw, Search, X } from "lucide-react";

import { GitHubRepository } from "@/lib/github-api";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";

interface GitHubRepoSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRepo: (repo: GitHubRepository) => void;
  userId: string;
}

export default function GitHubRepoSelector({
  isOpen,
  onClose,
  onSelectRepo,
  userId,
}: GitHubRepoSelectorProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch repositories on mount
  useEffect(() => {
    if (isOpen && userId) {
      fetchRepositories();
    }
  }, [isOpen, userId]);

  const fetchRepositories = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/github/repositories`);
      if (!response.ok) {
        // If user needs to connect GitHub, redirect to install
        if (response.status === 401) {
          router.push("/api/github/install");
          onClose();
          return;
        }

        // For other errors, display the error but don't redirect
        const errorData = await response.json();
        console.error(
          "Repository fetch error:",
          errorData.error || "Unknown error",
        );
        setRepositories([]);
      } else {
        const data = await response.json();
        setRepositories(data.repositories || []);
      }
    } catch (error) {
      console.error("Error fetching repositories:", error);
      setRepositories([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter repositories by search query
  const filteredRepos = repositories.filter((repo) => {
    const query = searchQuery.toLowerCase();
    return (
      repo.name.toLowerCase().includes(query) ||
      repo.fullName.toLowerCase().includes(query) ||
      (repo.description && repo.description.toLowerCase().includes(query))
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitHubLogoIcon className="h-5 w-5" />
            <span>Select GitHub Repository</span>
          </DialogTitle>
          <DialogDescription>
            Choose a repository to analyze with InsightSeek
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search repositories..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 rounded-full p-0"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear</span>
                </Button>
              )}
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={fetchRepositories}
              disabled={isLoading}
              title="Refresh repositories"
            >
              {isLoading ? (
                <Spinner size="small" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex h-60 items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                <Spinner size="large" />
                <span>Loading repositories...</span>
              </div>
            </div>
          ) : repositories.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-full bg-muted p-3">
                <GitHubLogoIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No repositories found</h3>
              <p className="text-sm text-muted-foreground">
                We couldn't find any repositories in your GitHub account.
              </p>
              <Button
                onClick={() => router.push("/api/github/install")}
                className="mt-2"
              >
                Configure GitHub App
              </Button>
            </div>
          ) : (
            <div>
              <Command className="rounded-lg border shadow-md">
                <CommandList>
                  <CommandEmpty>No repositories found</CommandEmpty>
                  <ScrollArea className="h-60">
                    <CommandGroup>
                      {filteredRepos.map((repo) => (
                        <CommandItem
                          key={repo.id}
                          onSelect={() => {
                            onSelectRepo(repo);
                            onClose();
                          }}
                          className="cursor-pointer"
                        >
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GitHubLogoIcon className="h-4 w-4" />
                              <span className="font-medium">
                                {repo.fullName}
                              </span>
                              {repo.private && (
                                <Lock className="ml-1 h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {repo.language && (
                                <span className="text-xs text-muted-foreground">
                                  {repo.language}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 rounded-full p-0"
                                asChild
                              >
                                <a
                                  href={repo.htmlUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span className="sr-only">View</span>
                                </a>
                              </Button>
                            </div>
                          </div>
                          {repo.description && (
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {repo.description}
                            </div>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </ScrollArea>
                </CommandList>
              </Command>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                Can't find your repository? Make sure you've{" "}
                <a
                  href="/api/github/install"
                  className="text-primary hover:underline"
                  onClick={() => onClose()}
                >
                  installed our GitHub App
                </a>{" "}
                on your organization.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
