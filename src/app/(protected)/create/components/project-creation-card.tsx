"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ValidationStatus } from "@prisma/client";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import axios from "axios";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Info,
  Plus,
  X,
} from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { isAbortOrTimeoutError } from "@/lib/error-utils";
import { GitHubRepository } from "@/lib/github-api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import GitHubBranchSelector from "@/components/github-branch-selector";
import GitHubRepoSelector from "@/components/github-repo-selector";

import { CreateProjectFormData } from "../page";

interface ProjectCreationCardProps {
  form: UseFormReturn<CreateProjectFormData>;
  userId?: string;
  onSuccess: (projectId: string) => void;
}

// Timeout constants in milliseconds
const VALIDATION_TIMEOUT_MS = 240000; // 4 minutes

export default function ProjectCreationCard({
  form,
  userId,
  onSuccess,
}: ProjectCreationCardProps) {
  // Dialog state for repo selector
  const [isRepoSelectorOpen, setIsRepoSelectorOpen] = useState(false);

  // Track selected repository details
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(
    null,
  );

  // Parse owner and repo name from selected repository
  const [repoOwner, setRepoOwner] = useState<string>("");
  const [repoName, setRepoName] = useState<string>("");

  // Improved branch loading state tracking
  const [branchState, setBranchState] = useState<{
    isLoading: boolean;
    isLoaded: boolean;
    branches: any[]; // Using 'any' to match GitHubBranch type without importing
  }>({
    isLoading: false,
    isLoaded: false,
    branches: [],
  });

  // Validation states
  const [validationState, setValidationState] = useState<
    "idle" | "validating" | "validated" | "error"
  >("idle");
  const [validationError, setValidationError] = useState<string | null>(null);

  // GitHub status for conditional UI
  const { data: githubData } = api.user.getGithubStatus.useQuery();
  const hasGithubConnection = !!githubData?.connected;

  // Validation status polling
  const [validationPolling, setValidationPolling] = useState(false);

  // Track if we're in a validation initializing state (just requested validation but record not yet created)
  const [validationInitializing, setValidationInitializing] = useState(false);

  // Use query for validation status polling
  const { data: validationResult } = api.project.getValidationStatus.useQuery(
    {
      githubUrl: form.getValues("repoUrl"),
      branch: form.getValues("branch"),
    },
    {
      enabled:
        validationPolling &&
        !validationInitializing && // Don't query until initializing is done
        !!form.getValues("repoUrl") &&
        !!form.getValues("branch"),
      refetchInterval: validationPolling ? 2000 : false,
      retry: validationPolling,
      retryDelay: 2000,
    },
  );

  // Handle errors in validation status fetch
  useEffect(() => {
    // If we're initializing or not polling, don't worry about errors
    if (validationInitializing || !validationPolling) return;

    // Set up error handling for missing validation results
    const errorTimeout = setTimeout(() => {
      // If we're still polling but can't find the record after a while, give up
      if (validationPolling && !validationResult) {
        setValidationPolling(false);
        setValidationState("error");
        setValidationError("Repository validation failed. Please try again.");
        toast.error("Repository validation failed. Please try again.");
      }
    }, 5000); // Give it 5 seconds to find the record

    return () => clearTimeout(errorTimeout);
  }, [validationPolling, validationInitializing, validationResult]);

  // Effect to handle validation status changes
  useEffect(() => {
    if (!validationResult) return;

    // Once we get a valid result, we're definitely not initializing anymore
    if (validationInitializing) {
      setValidationInitializing(false);
    }

    // Check if this validation result is for the current form values
    // This prevents stale validation results from being used
    const currentGithubUrl = form.getValues("repoUrl");
    const currentBranch = form.getValues("branch");

    if (
      validationResult.githubUrl !== currentGithubUrl ||
      validationResult.branch !== currentBranch
    ) {
      // This is a stale result, ignore it
      console.log("Ignoring stale validation result");
      return;
    }

    if (validationResult.status === ValidationStatus.COMPLETED) {
      setValidationPolling(false);
      setValidationState("validated");

      if (!validationResult.hasEnoughCredits) {
        toast.warning("You need more credits to create this project.");
      }
    } else if (validationResult.status === ValidationStatus.ERROR) {
      setValidationPolling(false);
      setValidationState("error");
      setValidationError(
        validationResult.error || "Repository validation failed",
      );
      toast.error(validationResult.error || "Failed to validate repository");
    }
  }, [validationResult, validationInitializing, form]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Stop all validation processes when component unmounts
      setValidationPolling(false);
      setValidationInitializing(false);
    };
  }, []);

  // Background validation function
  const validateRepositoryBackground = async (
    githubUrl: string,
    branch: string,
  ) => {
    if (!userId) return;

    try {
      // Set initializing state to prevent premature queries
      setValidationInitializing(true);

      // Start the background validation
      await axios.post("/api/validate-repository", {
        githubUrl,
        branch,
        userId,
      });

      // Give the database a moment to create the record before we start polling
      setTimeout(() => {
        setValidationInitializing(false);
        setValidationPolling(true);
      }, 1000);
    } catch (error) {
      console.error("Error starting repository validation:", error);
      setValidationState("error");
      setValidationError("Failed to start repository validation");
      toast.error("Failed to start repository validation");
      setValidationInitializing(false);
    }
  };

  // Credit validation mutation - keep for compatibility, but we'll use the background function
  const checkCredits = api.project.checkCredits.useMutation({
    onSuccess: (data) => {
      setValidationState("validated");
      if (data.fileCount > data.userCredits) {
        toast.warning("You need more credits to create this project.");
      }
    },
    onError: (error) => {
      // If we got a "Stream closed" error, switch to background validation
      if (isAbortOrTimeoutError(error)) {
        const data = form.getValues();
        validateRepositoryBackground(data.repoUrl, data.branch);
        return;
      }

      setValidationState("error");
      setValidationError(error.message || "Invalid repository");
      toast.error(error.message || "Failed to validate repository");
    },
  });

  // Clear validation when repo or branch changes
  const resetValidation = useCallback(() => {
    // Stop any active polling
    setValidationPolling(false);
    // Reset all validation states
    setValidationInitializing(false);
    setValidationState("idle");
    setValidationError(null);
    checkCredits.reset();
  }, [checkCredits]);

  // Project creation mutation
  const createProject = api.project.createProject.useMutation({
    onSuccess: async (project) => {
      // Store the newly created project ID in localStorage
      localStorage.setItem("lastCreatedProject", project.id);

      try {
        // Call the process-commits API with the isProjectCreation flag
        await fetch("/api/process-commits", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: project.id,
            githubUrl: project.githubUrl,
            isProjectCreation: true, // Add this flag
          }),
        });
      } catch (error) {
        console.error("Error processing commits:", error);
        // Don't show an error toast as it might confuse the user
      }

      toast.success("Project created successfully!");
      onSuccess(project.id);
    },
    onError: (error) => {
      // Check if this is a "Stream closed" error - which can be safely ignored
      // as the project is actually created successfully but the connection timed out
      if (isAbortOrTimeoutError(error)) {
        console.warn(
          "Project creation timed out, but likely succeeded:",
          error,
        );

        // Check if we have a projectId in the error object (added by the server)
        // @ts-expect-error - custom field we're adding on the server
        const projectId = error.data?.projectId;

        if (projectId) {
          // We have the project ID, so we can redirect as if it succeeded
          localStorage.setItem("lastCreatedProject", projectId);
          toast.success(
            "Project created successfully! (Connection timed out but project was created)",
          );
          onSuccess(projectId);
        } else {
          // No project ID, redirect to dashboard anyway
          toast.success(
            "Project likely created successfully. Check your dashboard.",
          );
          window.location.href = "/dashboard";
        }
        return;
      }

      // Handle all other errors normally
      toast.error(error.message || "Failed to create project");
      setValidationState("error");
      setValidationError(error.message || "Failed to create project");
    },
  });

  // Use a ref to track previous repo to prevent unnecessary state updates
  const prevRepoRef = useRef<string>("");

  // Handle branch loading state changes - use memoized callback
  const handleBranchLoadingChange = useCallback((isLoading: boolean) => {
    setBranchState((prev) => ({
      ...prev,
      isLoading,
    }));
  }, []);

  // Handle branches loaded event - use memoized callback
  const handleBranchesLoaded = useCallback((branches: any[]) => {
    setBranchState((prev) => {
      // Only update if not already loaded to prevent cycles
      if (prev.isLoaded) return prev;

      return {
        isLoading: false,
        isLoaded: true,
        branches,
      };
    });
  }, []);

  // Handle repository selection with safeguards against redundant updates
  const handleSelectRepo = useCallback(
    (repo: GitHubRepository) => {
      // Skip update if selecting the same repo
      if (prevRepoRef.current === repo.fullName) return;

      // We're changing repos, so reset all validation
      resetValidation();

      prevRepoRef.current = repo.fullName;
      setSelectedRepo(repo);

      // Update form values
      form.setValue("repoUrl", repo.htmlUrl);
      form.setValue("projectName", repo.name);
      form.trigger(["repoUrl", "projectName"]);

      // Clear the branch selection when changing repositories
      form.setValue("branch", "");

      // Reset branch state when changing repositories - do this once
      setBranchState({
        isLoading: true,
        isLoaded: false,
        branches: [],
      });

      // Parse owner and repo name from full name
      const parts = repo.fullName.split("/");
      if (parts.length === 2) {
        setRepoOwner(parts[0] || "");
        setRepoName(parts[1] || "");
      }
    },
    [form, resetValidation],
  );

  // Handle branch selection
  const handleSelectBranch = (branch: string) => {
    form.setValue("branch", branch);
    form.trigger("branch");
    resetValidation();
  };

  // Handle form submission
  const onSubmit = (data: CreateProjectFormData) => {
    if (validationState === "validated" && validationResult) {
      // Proceed with project creation
      createProject.mutate({
        githubUrl: data.repoUrl,
        name: data.projectName,
        branch: data.branch,
      });
      return;
    }

    // Otherwise, validate the repo first
    setValidationState("validating");
    setValidationError(null);

    // Start background validation directly
    validateRepositoryBackground(data.repoUrl, data.branch);
  };

  // Check if user has enough credits - use validation result if available
  const hasEnoughCredits = validationResult
    ? (validationResult.hasEnoughCredits ?? true)
    : true;

  // Determine if validation should be allowed
  const canValidate =
    selectedRepo &&
    form.getValues("branch") &&
    branchState.isLoaded &&
    !branchState.isLoading;

  // Check form validity with improved conditions
  const formIsValid =
    form.formState.isValid &&
    form.getValues("projectName") !== "" &&
    form.getValues("branch") !== "" &&
    form.getValues("repoUrl") !== "" &&
    !branchState.isLoading;

  // Handle loading/polling for validation with spinner or indicator
  const isValidating =
    validationPolling || checkCredits.isPending || validationInitializing;

  // Get the correct button text based on validation state
  const getButtonText = () => {
    if (createProject.isPending) {
      return "Creating Project...";
    }

    if (isValidating) {
      return "Checking Repository";
    }

    if (validationState === "validated") {
      return "Create Project";
    }

    return "Check Repository";
  };

  // Get the appropriate icon for the button
  const getButtonIcon = () => {
    if (isValidating || createProject.isPending) {
      // No icon needed when validating or creating (we show a spinner)
      return null;
    }

    if (validationState === "validated") {
      // Show plus icon for create project
      return <Plus className="h-4 w-4" />;
    }

    // Show search/check icon for checking repository
    return <Info className="h-4 w-4" />;
  };

  // Set up error handling for validation timeouts
  useEffect(() => {
    if (!isValidating) return;

    // Set a timeout to handle validation that takes too long
    const timeoutId = setTimeout(() => {
      if (isValidating && !validationResult) {
        // If we're still validating after the timeout, show an error
        setValidationPolling(false);
        setValidationInitializing(false);
        setValidationState("error");
        setValidationError(
          "Repository validation timed out. Please try again.",
        );
        toast.error("Repository validation took too long. Please try again.");
      }
    }, VALIDATION_TIMEOUT_MS); // 4 minutes timeout

    return () => clearTimeout(timeoutId);
  }, [isValidating, validationResult]);

  return (
    <>
      <Card className="dark:border-secondary">
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Enter your project name and select a GitHub repository
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="project-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            {/* Project Name Field */}
            <FormField
              control={form.control}
              name="projectName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My Awesome Project"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        resetValidation();
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    This is how your project will appear in the dashboard.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Repository Selection */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-1 sm:items-center justify-between">
                <FormLabel className="text-sm font-medium">
                  GitHub Repository
                </FormLabel>
                {hasGithubConnection && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsRepoSelectorOpen(true)}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Browse Repositories</span>
                  </Button>
                )}
              </div>

              {selectedRepo ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md border border-input bg-background p-3 gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md  gap-2 p-1.5 sm:p-0">
                    <div className="flex h-8 w-8 shrink-0 items-center sm:justify-center rounded-full border bg-background">
                      <GitHubLogoIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium break-words">
                        {selectedRepo.fullName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selectedRepo.private ? "Private" : "Public"} repository
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 rounded-full p-0"
                    onClick={() => {
                      setSelectedRepo(null);
                      setRepoOwner("");
                      setRepoName("");
                      form.setValue("repoUrl", "");
                      form.setValue("branch", "");
                      resetValidation();
                    }}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Clear</span>
                  </Button>
                </div>
              ) : (
                <div className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-muted-foreground/20 bg-muted/20 p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {hasGithubConnection
                      ? "Click 'Browse Repositories' to select a GitHub repository"
                      : "Install our GitHub App to select repositories"}
                  </p>
                  {!hasGithubConnection && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        (window.location.href = "/api/github/install")
                      }
                    >
                      <GitHubLogoIcon className="h-4 w-4" />
                      <span>Install GitHub App</span>
                    </Button>
                  )}
                </div>
              )}

              {/* Store the GitHub URL in a hidden input */}
              <FormField
                control={form.control}
                name="repoUrl"
                render={({ field }) => <input type="hidden" {...field} />}
              />
            </div>

            {/* Branch selector */}
            {repoOwner && repoName ? (
              <FormField
                control={form.control}
                name="branch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch</FormLabel>
                    <FormControl>
                      <GitHubBranchSelector
                        repoOwner={repoOwner}
                        repoName={repoName}
                        selectedBranch={field.value}
                        onSelectBranch={handleSelectBranch}
                        onLoadingChange={handleBranchLoadingChange}
                        onBranchesLoaded={handleBranchesLoaded}
                      />
                    </FormControl>
                    <FormDescription>
                      Select the branch you want to analyze.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {/* Validation states */}
            {validationState === "validating" && (
              <Alert variant="info" className="flex gap-2">
                <Spinner className="text-primary" />
                <div>
                  <AlertTitle>Validating repository...</AlertTitle>
                  <AlertDescription>
                    Please wait while we check your GitHub repository. This may
                    take a few moments.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {validationState === "error" && validationError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Repository validation failed</AlertTitle>
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {validationState === "validated" && validationResult && (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Repository validated successfully</AlertTitle>
                <AlertDescription>
                  {selectedRepo?.name || "Repository"} is ready to be indexed.
                  {selectedRepo?.private && " (Private repository)"}
                </AlertDescription>
              </Alert>
            )}

            {validationState === "validated" && validationResult && (
              <Alert variant="info">
                <Info className="h-4 w-4" />
                <AlertTitle>Credit Information</AlertTitle>
                <AlertDescription>
                  <div className="space-y-1 text-sm">
                    <p>
                      Credits required:{" "}
                      <strong>{validationResult.fileCount}</strong>
                    </p>
                    <p>
                      Your credits:{" "}
                      <strong>{validationResult.userCredits}</strong>
                    </p>
                    {!hasEnoughCredits && (
                      <p className="text-red-500 dark:text-red-400">
                        You need{" "}
                        {(validationResult.fileCount || 0) -
                          (validationResult.userCredits || 0)}{" "}
                        more credits.
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => (window.location.href = "/dashboard")}
            disabled={createProject.isPending}
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </Button>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {!hasEnoughCredits && validationState === "validated" && (
              <Link href="/billing" className="w-full sm:w-auto">
                <Button className="w-full" disabled={createProject.isPending}>
                  <CreditCard className="h-4 w-4" />
                  <span>Buy Credits</span>
                </Button>
              </Link>
            )}

            {/* Only show the submit button if user has enough credits or is not yet validated */}
            {(hasEnoughCredits || validationState !== "validated") && (
              <Button
                type="submit"
                form="project-form"
                className="w-full"
                disabled={
                  createProject.isPending ||
                  isValidating ||
                  !canValidate ||
                  !formIsValid
                }
              >
                {branchState.isLoading ? (
                  <>
                    <Spinner className="text-white" size="small" />
                    <span>Loading branches</span>
                  </>
                ) : (
                  <>
                    {!isValidating && getButtonIcon()}
                    <span>{getButtonText()}</span>
                    {(isValidating || createProject.isPending) && (
                      <Spinner className="text-white" size="small" />
                    )}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Repository selector dialog - key helps with resetting state if needed */}
      {userId && (
        <GitHubRepoSelector
          key={`repo-selector-${selectedRepo?.fullName || "none"}`}
          isOpen={isRepoSelectorOpen}
          onClose={() => setIsRepoSelectorOpen(false)}
          onSelectRepo={handleSelectRepo}
          userId={userId}
        />
      )}
    </>
  );
}
