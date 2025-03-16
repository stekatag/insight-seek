"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
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

  // Credit validation mutation - MOVED THIS BEFORE resetValidation
  const checkCredits = api.project.checkCredits.useMutation({
    onSuccess: (data) => {
      setValidationState("validated");
      if (data.fileCount > data.userCredits) {
        toast.warning("You need more credits to create this project.");
      }
    },
    onError: (error) => {
      setValidationState("error");
      setValidationError(error.message || "Invalid repository");
      toast.error(error.message || "Failed to validate repository");
    },
  });

  // Define resetValidation function early to avoid the "used before declaration" error
  const resetValidation = useCallback(
    () => {
      setValidationState("idle");
      setValidationError(null);
      checkCredits.reset();
    },
    [checkCredits], // Now checkCredits is properly declared before use
  );

  // Update resetValidation with proper dependency - ADD THIS BACK
  const resetValidationWithDeps = useCallback(resetValidation, [
    resetValidation,
  ]);

  // Project creation mutation
  const createProject = api.project.createProject.useMutation({
    onSuccess: (project) => {
      // Store the newly created project ID in localStorage
      localStorage.setItem("lastCreatedProject", project.id);

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

      prevRepoRef.current = repo.fullName;
      setSelectedRepo(repo);

      // Update form values
      form.setValue("repoUrl", repo.htmlUrl);
      form.setValue("projectName", repo.name);
      form.trigger(["repoUrl", "projectName"]);

      // Reset validation state
      resetValidationWithDeps();

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
    [form, resetValidationWithDeps],
  );

  // Handle branch selection
  const handleSelectBranch = (branch: string) => {
    form.setValue("branch", branch);
    form.trigger("branch");
    resetValidationWithDeps();
  };

  // Handle form submission
  const onSubmit = (data: CreateProjectFormData) => {
    if (validationState === "validated" && checkCredits.data) {
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

    checkCredits.mutate({
      githubUrl: data.repoUrl,
      branch: data.branch,
    });
  };

  // Check if user has enough credits
  const hasEnoughCredits = checkCredits.data?.userCredits
    ? checkCredits.data.fileCount <= checkCredits.data.userCredits
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
    if (checkCredits.isPending) {
      return "Validating Repository";
    }

    if (validationState === "validated") {
      return "Create Project";
    }

    return "Validate Repository";
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
                        resetValidationWithDeps();
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
                <div className="flex items-center justify-between rounded-md border border-input bg-background p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background">
                      <GitHubLogoIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">{selectedRepo.fullName}</div>
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
                      resetValidationWithDeps();
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
              <Alert variant="info" className="flex items-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mr-2"></div>
                <div>
                  <AlertTitle>Validating repository...</AlertTitle>
                  <AlertDescription>
                    Please wait while we check your GitHub repository.
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

            {validationState === "validated" && checkCredits.data && (
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Repository validated successfully</AlertTitle>
                <AlertDescription>
                  {selectedRepo?.name || "Repository"} is ready to be indexed.
                  {selectedRepo?.private && " (Private repository)"}
                </AlertDescription>
              </Alert>
            )}

            {validationState === "validated" && checkCredits.data && (
              <Alert variant="info">
                <Info className="h-4 w-4" />
                <AlertTitle>Credit Information</AlertTitle>
                <AlertDescription>
                  <div className="space-y-1 text-sm">
                    <p>
                      Credits required:{" "}
                      <strong>{checkCredits.data.fileCount}</strong>
                    </p>
                    <p>
                      Your credits:{" "}
                      <strong>{checkCredits.data.userCredits}</strong>
                    </p>
                    {!hasEnoughCredits && (
                      <p className="text-red-500 dark:text-red-400">
                        You need{" "}
                        {checkCredits.data.fileCount -
                          checkCredits.data.userCredits}{" "}
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

            <Button
              type="submit"
              form="project-form"
              className="w-full"
              disabled={
                createProject.isPending ||
                checkCredits.isPending ||
                (validationState === "validated" && !hasEnoughCredits) ||
                !canValidate || // Use our new improved check
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
                  <span>{getButtonText()}</span>
                  {(createProject.isPending || checkCredits.isPending) && (
                    <Spinner className="ml-2 text-white" size="small" />
                  )}
                </>
              )}
            </Button>
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
