"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  onLoadingChange?: (isLoading: boolean) => void;
  onBranchesLoaded?: (branches: GitHubBranch[]) => void;
}

export default function GitHubBranchSelector({
  repoOwner,
  repoName,
  selectedBranch,
  onSelectBranch,
  onLoadingChange,
  onBranchesLoaded,
}: GitHubBranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Track current fetch request details to avoid race conditions
  const currentFetchRef = useRef<{
    owner: string;
    name: string;
    id: number;
  } | null>(null);
  const fetchIdCounter = useRef(0);

  // Use refs for callback props to avoid dependency changes triggering re-fetches
  const onLoadingChangeRef = useRef(onLoadingChange);
  const onBranchesLoadedRef = useRef(onBranchesLoaded);
  const onSelectBranchRef = useRef(onSelectBranch);

  // Update refs when props change
  useEffect(() => {
    onLoadingChangeRef.current = onLoadingChange;
    onBranchesLoadedRef.current = onBranchesLoaded;
    onSelectBranchRef.current = onSelectBranch;
  });

  // Get the display name of the currently selected branch
  const displayBranch =
    branches.find((b) => b.name === selectedBranch)?.name || selectedBranch;

  const fetchBranches = useCallback(async () => {
    if (!repoOwner || !repoName) return;

    // Generate unique ID for this fetch request
    const fetchId = ++fetchIdCounter.current;
    currentFetchRef.current = { owner: repoOwner, name: repoName, id: fetchId };

    // Set loading state immediately
    setIsLoading(true);
    if (onLoadingChangeRef.current) onLoadingChangeRef.current(true);

    try {
      const response = await fetch(
        `/api/github/branches?owner=${repoOwner}&repo=${repoName}`,
      );

      // Check if this request is still relevant (no newer requests started)
      if (currentFetchRef.current?.id !== fetchId) {
        console.log("Ignoring stale branch fetch result");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const loadedBranches = data.branches || [];
      setBranches(loadedBranches);

      // Notify parent that branches were loaded - use ref to avoid dependency issues
      if (onBranchesLoadedRef.current) {
        onBranchesLoadedRef.current(loadedBranches);
      }

      // Select default branch if none is selected
      if (!selectedBranch && loadedBranches.length > 0) {
        const defaultBranch = loadedBranches.find(
          (branch: GitHubBranch) => branch.default,
        );
        if (defaultBranch) {
          if (onSelectBranchRef.current)
            onSelectBranchRef.current(defaultBranch.name);
        } else if (loadedBranches[0]) {
          if (onSelectBranchRef.current)
            onSelectBranchRef.current(loadedBranches[0].name);
        }
      }
    } catch (error) {
      console.error("Error fetching branches:", error);
      setBranches([]);
    } finally {
      // Only update loading state if this is still the current request
      if (currentFetchRef.current?.id === fetchId) {
        setIsLoading(false);
        if (onLoadingChangeRef.current) onLoadingChangeRef.current(false);
      }
    }
  }, [repoOwner, repoName, selectedBranch]); // Remove callback dependencies

  // Detect initial load or repository change
  useEffect(() => {
    // Only fetch if we have both owner and name
    if (repoOwner && repoName) {
      const repoChanged =
        !currentFetchRef.current ||
        currentFetchRef.current.owner !== repoOwner ||
        currentFetchRef.current.name !== repoName;

      if (repoChanged) {
        // Clear branches immediately to prevent showing stale data
        setBranches([]);
        // Fetch branches for the new repo (with slight delay to prevent render cycles)
        const timerId = setTimeout(fetchBranches, 0);
        return () => clearTimeout(timerId);
      }
    }

    return () => {
      // Clean up when component unmounts or repo changes
      currentFetchRef.current = null;
    };
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
            disabled={isLoading || branches.length === 0}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Spinner size="small" />
                <span>Loading branches...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <GitBranch className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {displayBranch || "Select branch"}
                </span>
              </div>
            )}
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
