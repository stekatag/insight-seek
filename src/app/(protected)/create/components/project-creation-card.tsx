"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { validateRepositoryTask } from "@/trigger/validateRepository";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
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
import { generateTriggerRunToken } from "@/app/actions/triggerActions";
import { requestRepositoryValidationAction } from "@/app/actions/validationActions";

import { CreateProjectFormData } from "../page";

interface ProjectCreationCardProps {
  form: UseFormReturn<CreateProjectFormData>;
  userId?: string;
  onSuccess: (projectId: string) => void;
}

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

  // Add state for Trigger.dev run ID
  const [validationRunId, setValidationRunId] = useState<string | null>(null);
  const [validationAccessToken, setValidationAccessToken] = useState<
    string | null
  >(null);
  const [isCurrentValidationComplete, setIsCurrentValidationComplete] =
    useState(false);

  // Use the real-time hook
  const { run, error: runError } = useRealtimeRun<
    typeof validateRepositoryTask
  >(validationRunId ?? undefined, {
    accessToken: validationAccessToken ?? undefined,
    enabled: !!validationRunId && !!validationAccessToken,
  });

  // Project creation states
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectCreationId, setProjectCreationId] = useState<string | null>(
    null,
  );
  const [projectCreationPolling, setProjectCreationPolling] = useState(false);

  // GitHub status for conditional UI
  const { data: githubData } = api.user.getGithubStatus.useQuery();
  const hasGithubConnection = !!githubData?.connected;

  // Use the existing project creation status query
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

  // Use the existing project creation status handling logic
  useEffect(() => {
    if (!projectCreationStatus) return;

    if (
      projectCreationStatus.status === "COMPLETED" &&
      projectCreationStatus.projectId
    ) {
      const projectId = projectCreationStatus.projectId;
      setProjectCreationPolling(false);
      setIsCreatingProject(false);
      localStorage.setItem("lastCreatedProject", projectId);
      toast.success("Project created successfully! Redirecting...");
      onSuccess(projectId);
    } else if (projectCreationStatus.status === "ERROR") {
      setProjectCreationPolling(false);
      setIsCreatingProject(false);
      toast.error(projectCreationStatus.error || "Failed to create project");
    } else if (
      ["INITIALIZING", "CREATING_PROJECT", "INDEXING"].includes(
        projectCreationStatus.status,
      )
    ) {
      if (!projectCreationPolling) {
        setProjectCreationPolling(true);
      }
    }
  }, [projectCreationStatus, onSuccess, projectCreationPolling]);

  // Effect to update isCurrentValidationComplete based on run status
  useEffect(() => {
    if (
      run?.status === "COMPLETED" &&
      run?.output?.status === "success" &&
      !!validationRunId &&
      run?.id === validationRunId
    ) {
      setIsCurrentValidationComplete(true);
    }
  }, [run?.status, run?.output?.status, validationRunId, run?.id]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      setProjectCreationPolling(false);
      localStorage.removeItem("projectCreationInProgress");
      // Reset validation run ID and token on unmount
      setValidationRunId(null);
      setValidationAccessToken(null);
    };
  }, []);

  // Reset validation function
  const resetValidation = useCallback(() => {
    // Reset run ID and token
    setValidationRunId(null);
    setValidationAccessToken(null);
    setIsCurrentValidationComplete(false);
  }, []);

  // Start project creation mutation
  const startProjectCreation = api.project.startProjectCreation.useMutation({
    onSuccess: async (data) => {
      if (data.success && data.projectCreationId) {
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

  // Handle branch loading state changes
  const handleBranchLoadingChange = useCallback((isLoading: boolean) => {
    setBranchState((prev) => ({
      ...prev,
      isLoading,
    }));
  }, []);

  // Handle branches loaded event
  const handleBranchesLoaded = useCallback((branches: any[]) => {
    setBranchState((prev) => {
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
      if (prevRepoRef.current === repo.fullName) return;
      resetValidation();
      prevRepoRef.current = repo.fullName;
      setSelectedRepo(repo);
      form.setValue("repoUrl", repo.htmlUrl);
      form.setValue("projectName", repo.name);
      form.trigger(["repoUrl", "projectName"]);
      form.setValue("branch", "");
      setBranchState({
        isLoading: true,
        isLoaded: false,
        branches: [],
      });
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

  // --- Derive validation state from useRealtimeRun ---
  // Explicit terminal states we care about
  const terminalStatuses = [
    "COMPLETED",
    "FAILED",
    "CRASHED",
    "CANCELED",
    "TIMED_OUT",
    "INTERRUPTED",
    "SYSTEM_FAILURE",
  ];

  const validationStatus = run?.status;
  const validationOutput = run?.output;
  const validationError = runError?.message || validationOutput?.error;
  const fileCount = validationOutput?.fileCount;
  const userCredits = validationOutput?.userCredits;

  // Determine if validation has failed (error from hook OR error status from output)
  const hasValidationError = !!(
    runError ||
    (run?.status === "COMPLETED" && run.output?.status === "error")
  );

  // Determine if validation is actively running
  const isValidating = !!(
    validationRunId &&
    run?.status &&
    !terminalStatuses.includes(run.status) &&
    !hasValidationError &&
    !isCurrentValidationComplete
  );

  // Check if user has enough credits based on run output
  const hasEnoughCredits =
    isCurrentValidationComplete &&
    typeof fileCount === "number" &&
    typeof userCredits === "number"
      ? userCredits >= fileCount
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

  // Get the correct button text based on validation state
  const getButtonText = () => {
    if (isCreatingProject) {
      return "Creating Project...";
    }

    if (isValidating) {
      return "Checking Repository";
    }

    if (isCurrentValidationComplete && hasEnoughCredits) {
      return "Create Project";
    }

    if (isCurrentValidationComplete && !hasEnoughCredits) {
      return "Insufficient Credits";
    }

    return "Check Repository";
  };

  // Get the appropriate icon for the button
  const getButtonIcon = () => {
    if (isValidating || isCreatingProject) {
      return null;
    }

    if (isCurrentValidationComplete && hasEnoughCredits) {
      return <Plus className="h-4 w-4" />;
    }

    return <Info className="h-4 w-4" />;
  };

  // Handle form submission
  const onSubmit = async (data: CreateProjectFormData) => {
    // If current validation is complete with enough credits, proceed to creation
    if (isCurrentValidationComplete && hasEnoughCredits) {
      setIsCreatingProject(true);
      startProjectCreation.mutate({
        githubUrl: data.repoUrl,
        name: data.projectName,
        branch: data.branch,
      });
      return;
    }

    // If validation is complete but credits are insufficient, do nothing (or show message)
    if (isCurrentValidationComplete && !hasEnoughCredits) {
      toast.error("Insufficient credits to create the project.");
      return;
    }

    // Otherwise (not validated or starting fresh), trigger validation via Server Action
    resetValidation();

    try {
      // 1. Request validation and get runId
      const validationRequestResult = await requestRepositoryValidationAction({
        githubUrl: data.repoUrl,
        branch: data.branch,
      });

      if (validationRequestResult.success && validationRequestResult.runId) {
        const runId = validationRequestResult.runId;

        // 2. Generate the public access token for this runId
        const tokenResult = await generateTriggerRunToken({ runId });

        if (tokenResult.success && tokenResult.token) {
          // 3. Set state to start monitoring with the hook
          setValidationAccessToken(tokenResult.token);
          setIsCurrentValidationComplete(false);
          setValidationRunId(runId);
        } else {
          toast.error(
            tokenResult.error || "Failed to get access token for validation.",
          );
        }
      } else {
        toast.error(
          validationRequestResult.error || "Failed to start validation check.",
        );
      }
    } catch (error) {
      console.error(
        "Error during validation request or token generation:",
        error,
      );
      toast.error("An unexpected error occurred while requesting validation.");
    }
  };

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
            {isValidating && (
              <Alert variant="info" className="flex gap-2">
                <Spinner className="text-primary" />
                <div>
                  <AlertTitle>Validating repository...</AlertTitle>
                  <AlertDescription>
                    Please wait while we check your GitHub repository.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {hasValidationError && !isCurrentValidationComplete && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Repository validation failed</AlertTitle>
                <AlertDescription>
                  {validationError || "An unknown error occurred."}
                </AlertDescription>
              </Alert>
            )}

            {isCurrentValidationComplete && (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Repository validated successfully</AlertTitle>
                <AlertDescription>
                  {selectedRepo?.name || "Repository"} is ready to be indexed.
                  {selectedRepo?.private && " (Private repository)"}
                </AlertDescription>
              </Alert>
            )}

            {/* Credit Information Alert - uses derived state */}
            {isCurrentValidationComplete &&
              typeof fileCount === "number" &&
              typeof userCredits === "number" && (
                <Alert variant="info">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Credit Information</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-1 text-sm">
                      <p>
                        Credits required: <strong>{fileCount}</strong>
                      </p>
                      <p>
                        Your credits: <strong>{userCredits}</strong>
                      </p>
                      {!hasEnoughCredits && (
                        <p className="text-red-500 dark:text-red-400">
                          You need {fileCount - userCredits} more credits.
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
            {!hasEnoughCredits && isCurrentValidationComplete && (
              <Link href="/billing" className="w-full sm:w-auto">
                <Button className="w-full" disabled={isCreatingProject}>
                  <CreditCard className="h-4 w-4" />
                  <span>Buy Credits</span>
                </Button>
              </Link>
            )}

            {!(isCurrentValidationComplete && !hasEnoughCredits) && (
              <Button
                type="submit"
                form="project-form"
                className="w-full"
                disabled={
                  isCreatingProject ||
                  isValidating ||
                  !canValidate ||
                  !formIsValid ||
                  branchState.isLoading ||
                  (isCurrentValidationComplete && !hasEnoughCredits)
                }
              >
                {branchState.isLoading ? (
                  <>
                    <Spinner className="text-white" size="small" />
                    <span>Loading branches</span>
                  </>
                ) : (
                  <>
                    {!isValidating && !isCreatingProject && getButtonIcon()}
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
