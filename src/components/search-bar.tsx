"use client";

import { useEffect, useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { api } from "@/trpc/react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  SearchIcon,
  Folder,
  GitCommit,
  MessageSquare,
  Presentation,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { truncateText, TRUNCATION_LIMITS } from "@/lib/utils";

export function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearchTerm] = useDebounceValue(inputValue, 300);

  // Fetch search results
  const { data, isLoading, isFetching } = api.search.search.useQuery(
    { query: debouncedSearchTerm, limit: 5 },
    {
      enabled: debouncedSearchTerm.length >= 2,
      staleTime: 180000, // Results stay fresh for 3 minutes
    },
  );

  const handleSelect = (value: string) => {
    setOpen(false);

    // Parse selected item
    try {
      const [type, id] = value.split(":");

      switch (type) {
        case "project":
          router.push("/dashboard");
          break;
        case "question":
          router.push(`/qa?questionId=${id}`);
          break;
        case "meeting":
          router.push(`/meetings/${id}`);
          break;
        case "commit": {
          // Find the commit by id to get hash and repo URL
          const commit = data?.commits.find((c) => c.id === id);
          if (commit && commit.commitHash && commit.project.githubUrl) {
            // Open the commit in GitHub in a new tab
            window.open(
              `${commit.project.githubUrl}/commit/${commit.commitHash}`,
              "_blank",
              "noopener,noreferrer",
            );
          } else {
            // Fallback to dashboard if commit info not available
            router.push("/dashboard");
          }
          break;
        }
      }
    } catch (error) {
      console.error("Failed to navigate to search result", error);
    }
  };

  // Handle keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative w-full max-w-sm">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="relative w-full justify-between md:w-64 lg:w-80"
          >
            <span className="flex items-center">
              <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              Search...
            </span>
            <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          side="bottom"
          sideOffset={5}
          style={{ width: "var(--radix-popover-trigger-width)" }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search projects, questions, meetings..."
              value={inputValue}
              onValueChange={setInputValue}
              className="h-9"
            />
            <CommandList>
              {(isLoading || isFetching) && debouncedSearchTerm.length >= 2 && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isLoading &&
                debouncedSearchTerm.length >= 2 &&
                !data?.projects.length &&
                !data?.questions.length &&
                !data?.meetings.length &&
                !data?.commits.length && (
                  <CommandEmpty>No results found.</CommandEmpty>
                )}

              {/* Projects */}
              {data?.projects.length ? (
                <CommandGroup heading="Projects">
                  {data.projects.map((project) => (
                    <CommandItem
                      key={`project:${project.id}`}
                      value={`project:${project.id}`}
                      onSelect={handleSelect}
                      className="flex items-center"
                    >
                      <Folder className="mr-2 h-4 w-4 text-blue-600" />
                      <div className="flex flex-col">
                        <span
                          className="text-sm font-medium"
                          title={project.name}
                        >
                          {project.name}
                        </span>
                        <span
                          className="max-w-xs truncate text-xs text-muted-foreground"
                          title={project.githubUrl}
                        >
                          {project.githubUrl}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {/* Questions */}
              {data?.questions.length ? (
                <CommandGroup heading="Questions">
                  {data.questions.map((question) => (
                    <CommandItem
                      key={`question:${question.id}`}
                      value={`question:${question.id}`}
                      onSelect={handleSelect}
                      className="flex items-center"
                    >
                      <MessageSquare className="mr-2 h-4 w-4 text-purple-600" />
                      <div className="flex flex-col">
                        <span
                          className="text-sm font-medium"
                          title={question.question}
                        >
                          {truncateText(
                            question.question,
                            TRUNCATION_LIMITS.QUESTION,
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {question.project.name} ·{" "}
                          {formatDistanceToNow(question.createdAt, {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {/* Meetings */}
              {data?.meetings.length ? (
                <CommandGroup heading="Meetings">
                  {data.meetings.map((meeting) => (
                    <CommandItem
                      key={`meeting:${meeting.id}`}
                      value={`meeting:${meeting.id}`}
                      onSelect={handleSelect}
                      className="flex items-center"
                    >
                      <Presentation className="mr-2 h-4 w-4 text-green-600" />
                      <div className="flex flex-col">
                        <span
                          className="text-sm font-medium"
                          title={meeting.name}
                        >
                          {truncateText(
                            meeting.name,
                            TRUNCATION_LIMITS.MEETING_NAME,
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {meeting.project.name} ·{" "}
                          {formatDistanceToNow(meeting.createdAt, {
                            addSuffix: true,
                          })}
                        </span>
                        {meeting.issues.length > 0 &&
                          meeting.issues[0]?.headline && (
                            <span
                              className="text-xs italic text-muted-foreground"
                              title={meeting.issues[0].headline}
                            >
                              "
                              {truncateText(
                                meeting.issues[0].headline,
                                TRUNCATION_LIMITS.SEARCH_RESULT,
                              )}
                              "
                            </span>
                          )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {/* Commits */}
              {data?.commits.length ? (
                <CommandGroup heading="Commits">
                  {data.commits.map((commit) => (
                    <CommandItem
                      key={`commit:${commit.id}`}
                      value={`commit:${commit.id}`}
                      onSelect={handleSelect}
                      className="flex items-center"
                    >
                      <GitCommit className="mr-2 h-4 w-4 text-orange-600" />
                      <div className="flex flex-col">
                        <span
                          className="text-sm font-medium"
                          title={commit.commitMessage}
                        >
                          {truncateText(
                            commit.commitMessage,
                            TRUNCATION_LIMITS.SEARCH_RESULT,
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {commit.project.name} ·{" "}
                          {formatDistanceToNow(commit.commitDate, {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>

            {debouncedSearchTerm.length >= 2 && data && (
              <div className="border-t p-2 text-center text-xs text-muted-foreground">
                {data.projects.length +
                  data.questions.length +
                  data.meetings.length +
                  data.commits.length}{" "}
                results
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
