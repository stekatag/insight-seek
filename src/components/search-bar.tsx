"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Folder,
  GitCommit,
  Loader2,
  MessageSquare,
  Presentation,
  SearchIcon,
} from "lucide-react";
import { useDebounceValue } from "usehooks-ts";

import { api } from "@/trpc/react";
import { truncateText, TRUNCATION_LIMITS } from "@/lib/utils";
// Import the project hook
import useProject from "@/hooks/use-project";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Spinner } from "./ui/spinner";

export function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearchTerm] = useDebounceValue(inputValue, 300);

  // Get the setProjectId function from the hook
  const { setProjectId } = useProject();

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
          // Ensure id is a valid string before setting/navigating
          if (typeof id === "string") {
            // Set the selected project ID first
            setProjectId(id);
            // Then navigate to the dashboard
            router.push("/dashboard");
          } else {
            console.error("Invalid project ID in search selection:", value);
          }
          break;
        case "question":
          // Find the selected question to get its chatId and potentially meetingId
          const question = data?.questions.find((q) => q.id === id);
          const chatId = question?.chat?.id;
          const meetingId = question?.chat?.meetingId;

          if (chatId) {
            if (meetingId) {
              // It's a meeting question, navigate to the meeting page with chat param
              router.push(`/meetings/${meetingId}?chat=${chatId}`);
            } else {
              // It's a project question, navigate to the QA page with chat param
              router.push(`/qa?chat=${chatId}`);
            }
          } else {
            // Fallback if chatId is somehow missing
            console.warn(`Could not find chatId for question ${id}`);
            router.push("/qa"); // Default fallback to QA page
          }
          break;
        case "meeting":
          router.push(`/meetings/${id}`);
          break;
        case "commit": {
          // Find the commit by id to get hash and repo URL
          const commit = data?.commits.find((c) => c.id === id);
          if (commit?.commitHash && commit.project?.githubUrl) {
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
                  <Spinner size="small" className="text-muted-foreground" />
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
                      className="flex items-center cursor-pointer"
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
                      className="flex items-center cursor-pointer"
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
                          {/* Add optional chaining */}
                          {question.project?.name} ·{" "}
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
                      className="flex items-center cursor-pointer"
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
                      className="flex items-center cursor-pointer"
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
