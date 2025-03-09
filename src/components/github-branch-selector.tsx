"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, GitBranch, RefreshCw } from "lucide-react";

import { GitHubBranch } from "@/lib/github-api";
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
import { Spinner } from "@/components/ui/spinner";

interface GitHubBranchSelectorProps {
  repoOwner: string;
  repoName: string;
  selectedBranch: string;
  onSelectBranch: (branch: string) => void;
}

export default function GitHubBranchSelector({
  repoOwner,
  repoName,
  selectedBranch,
  onSelectBranch,
}: GitHubBranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get the display name of the currently selected branch
  const displayBranch =
    branches.find((b) => b.name === selectedBranch)?.name || selectedBranch;

  // Define fetchBranches with useCallback to avoid recreating the function on every render
  const fetchBranches = useCallback(async () => {
    if (!repoOwner || !repoName) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/github/branches?owner=${repoOwner}&repo=${repoName}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setBranches(data.branches || []);

      // If no branch is selected yet, select the default branch
      if (!selectedBranch) {
        const defaultBranch = data.branches.find(
          (branch: GitHubBranch) => branch.default,
        );
        if (defaultBranch) {
          onSelectBranch(defaultBranch.name);
        } else if (data.branches.length > 0) {
          onSelectBranch(data.branches[0].name);
        }
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setIsLoading(false);
    }
  }, [repoOwner, repoName, selectedBranch, onSelectBranch]);

  useEffect(() => {
    if (repoOwner && repoName) {
      fetchBranches();
    }
  }, [repoOwner, repoName, fetchBranches]);

  return (
    <div className="flex items-center space-x-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            aria-label="Select a branch"
            className="w-[200px] justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <GitBranch className="h-4 w-4 shrink-0" />
              <span className="truncate">{displayBranch}</span>
            </div>
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandInput placeholder="Search branches..." />
            <CommandList>
              <CommandEmpty>No branches found</CommandEmpty>
              <CommandGroup>
                {isLoading ? (
                  <div className="flex h-24 items-center justify-center">
                    <Spinner size="small" />
                  </div>
                ) : (
                  branches.map((branch) => (
                    <CommandItem
                      key={branch.name}
                      value={branch.name}
                      onSelect={() => {
                        onSelectBranch(branch.name);
                        setIsOpen(false);
                      }}
                      className="flex cursor-pointer items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3.5 w-3.5" />
                        <span>{branch.name}</span>
                        {branch.default && (
                          <span className="ml-1 rounded bg-primary/10 px-1 text-xs text-primary">
                            default
                          </span>
                        )}
                      </div>
                      {branch.name === selectedBranch && (
                        <Check className="h-4 w-4" />
                      )}
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button
        size="icon"
        variant="ghost"
        onClick={fetchBranches}
        disabled={isLoading}
        className="h-10 w-10"
      >
        {isLoading ? (
          <Spinner size="small" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
