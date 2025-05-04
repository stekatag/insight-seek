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
import { requestRepositoryValidationAction } from "@/app/actions/validationActions";

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

  // Project creation states
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectCreationId, setProjectCreationId] = useState<string | null>(
    null,
  );
  const [projectCreationPolling, setProjectCreationPolling] = useState(false);

  // GitHub status for conditional UI
  const { data: githubData } = api.user.getGithubStatus.useQuery();
  const hasGithubConnection = !!githubData?.connected;

  // Validation status polling
  const [validationPolling, setValidationPolling] = useState(false);

  // Track if we're in a validation initializing state (just requested validation but record not yet created)
  const [validationInitializing, setValidationInitializing] = useState(false);

  // Track server action pending state
  const [isRequestingValidation, setIsRequestingValidation] = useState(false);

  // ID used for polling - set when server action returns success
  const [pollingValidationId, setPollingValidationId] = useState<string | null>(
    null,
  );

  // Query for validation status polling (watches form values AND uses pollingValidationId)
  const watchedRepoUrl = form.watch("repoUrl");
  const watchedBranch = form.watch("branch");
  const { data: validationResult, error: validationQueryError } =
    api.project.getValidationStatus.useQuery(
      {
        // These are needed to find the correct record in the DB via the unique constraint
        githubUrl: watchedRepoUrl,
        branch: watchedBranch,
      },
      {
        // Enable polling only if we have an ID from the action AND polling is active
        enabled:
          validationPolling &&
          !!pollingValidationId &&
          !!watchedRepoUrl &&
          !!watchedBranch,
        refetchInterval: 3000,
        retry: (failureCount, error: any) => {
          // Don't retry endlessly if the record isn't found initially (might be race condition)
          if (error?.data?.code === "NOT_FOUND") {
            return failureCount < 3;
          }
          if (
            error?.data?.code === "INTERNAL_SERVER_ERROR" ||
            failureCount >= 5
          )
            return false;
          return true;
        },
        refetchOnWindowFocus: false,
      },
    );

  // Project creation status polling
  const { data: projectCreationStatus } =
    api.project.getProjectCreationStatus.useQuery(
      { projectCreationId: projectCreationId || "" },
      {
        enabled: projectCreationPolling && !!projectCreationId,
        refetchInterval: projectCreationPolling ? 2000 : false,
        retry: projectCreationPolling,
        retryDelay: 2000,
      },
    );

  // Effect to handle polling results for validation
  useEffect(() => {
    if (!validationPolling || !validationResult || !pollingValidationId) return;

    // Ensure we are polling for the specific validation triggered
    if (validationResult.id !== pollingValidationId) {
      console.log("Stale validation result ignored (ID mismatch).");
      return;
    }

    switch (validationResult.status) {
      case ValidationStatus.PROCESSING:
        setValidationState("validating");
        setValidationError(null);
        break;
      case ValidationStatus.COMPLETED:
        setValidationState("validated");
        setValidationError(null);
        setValidationPolling(false); // Stop polling
        if (!validationResult.hasEnoughCredits) {
          toast.warning("You need more credits for this project.");
        }
        break;
      case ValidationStatus.ERROR:
        setValidationState("error");
        setValidationError(
          validationResult.error || "Repository validation failed.",
        );
        toast.error(validationResult.error || "Repository validation failed.");
        setValidationPolling(false); // Stop polling
        break;
    }
  }, [validationResult, validationPolling, pollingValidationId]);

  // Effect to handle query errors during validation polling
  useEffect(() => {
    if (validationQueryError && validationPolling) {
      console.error("Error polling validation status:", validationQueryError);
      // Don't set error state if it was just a NOT_FOUND during init/race condition
      if (validationQueryError.data?.code !== "NOT_FOUND") {
        setValidationState("error");
        setValidationError(
          "Failed to get validation status. Please try again.",
        );
        toast.error("Failed to get validation status.");
        setValidationPolling(false);
      }
    }
  }, [validationQueryError, validationPolling]);

  // Client-side timeout for validation
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    // Consider validating if the action is pending OR polling is active
    const isActiveValidating = isRequestingValidation || validationPolling;

    if (isActiveValidating) {
      timeoutId = setTimeout(() => {
        if (isRequestingValidation || validationPolling) {
          console.error("Client-side validation timeout reached.");
          setValidationState("error");
          setValidationError("Repository check timed out. Please try again.");
          toast.error("Repository check timed out. Please try again.");
          setValidationPolling(false);
          setIsRequestingValidation(false);
        }
      }, VALIDATION_TIMEOUT_MS);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isRequestingValidation, validationPolling]);

  // Effect to handle project creation status changes
  useEffect(() => {
    if (!projectCreationStatus) return;

    if (
      projectCreationStatus.status === "COMPLETED" &&
      projectCreationStatus.projectId
    ) {
      const projectId = projectCreationStatus.projectId;
      console.log(`Project ${projectId} created successfully.`);

      // Stop polling once we have the project ID
      setProjectCreationPolling(false);
      setIsCreatingProject(false);

      // Set flags for the commit log component to pick up
      localStorage.setItem("lastCreatedProject", projectId);

      toast.success("Project created successfully! Redirecting...");
      onSuccess(projectId); // Navigate
    } else if (projectCreationStatus.status === "ERROR") {
      // Stop polling on error
      setProjectCreationPolling(false);
      setIsCreatingProject(false);

      // Show error message
      toast.error(projectCreationStatus.error || "Failed to create project");
    } else if (
      ["INITIALIZING", "CREATING_PROJECT", "INDEXING"].includes(
        projectCreationStatus.status,
      )
    ) {
      // Ensure polling is active for in-progress projects
      if (!projectCreationPolling) {
        setProjectCreationPolling(true);
      }
    }
  }, [projectCreationStatus, onSuccess, projectCreationPolling]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Stop all polling processes when component unmounts
      setValidationPolling(false);
      setValidationInitializing(false);
      setProjectCreationPolling(false);

      // Clean up any pending localStorage flags to prevent state leakage
      localStorage.removeItem("projectCreationInProgress");
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
    setPollingValidationId(null); // Clear the ID used for polling
    checkCredits.reset();
  }, [checkCredits]);

  // Start project creation mutation
  const startProjectCreation = api.project.startProjectCreation.useMutation({
    onSuccess: async (data) => {
      if (data.success && data.projectCreationId) {
        console.log(
          "tRPC startProjectCreation succeeded, proceeding to poll.",
          data,
        );
        setProjectCreationId(data.projectCreationId);
        setProjectCreationPolling(true);
      } else {
        console.error(
          "tRPC startProjectCreation failed to trigger task:",
          data.message,
        );
        toast.error(data.message || "Failed to start project creation task.");
        setIsCreatingProject(false);
      }
    },
    onError: (error) => {
      console.error("tRPC startProjectCreation Error:", error);
      toast.error(error.message || "Failed to start project creation");
      setIsCreatingProject(false);
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
  const onSubmit = async (data: CreateProjectFormData) => {
    // Check if validation is complete and successful
    if (validationState === "validated" && validationResult?.hasEnoughCredits) {
      // Proceed with project creation (using the existing mutation for now)
      setIsCreatingProject(true);
      startProjectCreation.mutate({
        githubUrl: data.repoUrl,
        name: data.projectName,
        branch: data.branch,
      });
      return;
    }

    // If not validated or not enough credits, trigger validation via Server Action
    console.log("Triggering repository validation via Server Action...");
    setValidationState("validating");
    setValidationError(null);
    setPollingValidationId(null); // Clear previous polling ID
    setValidationPolling(false); // Ensure polling stops
    setIsRequestingValidation(true); // Set pending state for server action

    try {
      const result = await requestRepositoryValidationAction({
        githubUrl: data.repoUrl,
        branch: data.branch,
      });

      if (result.success && result.validationId) {
        console.log(
          "Server action successful, validation ID:",
          result.validationId,
        );
        setPollingValidationId(result.validationId); // Set the ID for polling
        setValidationPolling(true); // Start polling
      } else {
        console.error("Server action failed:", result.error);
        setValidationState("error");
        setValidationError(result.error || "Failed to start validation check.");
        toast.error(result.error || "Failed to start validation check.");
        setValidationPolling(false); // Ensure polling doesn't start on error
      }
    } catch (error) {
      console.error("Error calling server action:", error);
      setValidationState("error");
      setValidationError(
        "An unexpected error occurred while requesting validation.",
      );
      toast.error("An unexpected error occurred.");
      setValidationPolling(false);
    } finally {
      setIsRequestingValidation(false); // Clear pending state
    }
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
  const isValidating = isRequestingValidation || validationPolling;

  // Get the correct button text based on validation state
  const getButtonText = () => {
    if (isCreatingProject) {
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
    if (isValidating || isCreatingProject) {
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
            disabled={isCreatingProject}
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </Button>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {!hasEnoughCredits && validationState === "validated" && (
              <Link href="/billing" className="w-full sm:w-auto">
                <Button className="w-full" disabled={isCreatingProject}>
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
                  isCreatingProject ||
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
                    {(isValidating || isCreatingProject) && (
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
