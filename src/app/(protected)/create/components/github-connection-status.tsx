"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Settings,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

export default function GitHubConnectionStatus() {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "unknown" | "valid" | "invalid"
  >("unknown");
  const [initialVerificationComplete, setInitialVerificationComplete] =
    useState(false);

  // Store verification data from the API
  const [verificationData, setVerificationData] = useState<{
    isValid: boolean;
    username?: string;
    installationId?: string;
    error?: string;
  } | null>(null);

  // Check if user has GitHub App installed - basic check from DB
  const {
    data: githubData,
    isLoading: isLoadingGithub,
    refetch: refetchStatus,
  } = api.user.getGithubStatus.useQuery(undefined, {
    staleTime: 10000,
  });

  // Mutation to verify the token
  const verifyTokenQuery = api.user.verifyGithubToken.useMutation({
    onSuccess: (data) => {
      setIsVerifying(false);
      setVerificationData(data);

      if (data.isValid) {
        setConnectionStatus("valid");
        setVerificationSuccess(true);
        setVerificationError(null);
      } else {
        setConnectionStatus("invalid");
        setVerificationSuccess(false);
        setVerificationError(data.error || "Unknown verification error");
        // Only show toast for manual verification, not for initial verification
        if (initialVerificationComplete) {
          toast.error("GitHub connection verification failed");
        }
      }
    },
    onError: (error) => {
      setIsVerifying(false);
      setConnectionStatus("invalid");
      setVerificationError(error.message || "Failed to verify token");
      console.error("Error verifying token:", error);

      // Only show toast for manual verification, not for initial verification
      if (initialVerificationComplete) {
        toast.error("GitHub connection verification failed");
      }
    },
  });

  // Mutation to remove GitHub token
  const removeTokenMutation = api.user.removeGithubToken.useMutation();

  const hasGithubConnection = !!githubData?.connected;
  const projectCount = githubData?.projectCount || 0;
  const hasExistingProjects = projectCount > 0;

  // Verify connection when component mounts and connection exists
  useEffect(() => {
    // Only run verification if we have a GitHub connection according to the DB
    if (hasGithubConnection && connectionStatus === "unknown" && !isVerifying) {
      // Run initial verification
      setIsVerifying(true);
      verifyTokenQuery.mutate();
    }

    // Mark initial verification as complete after first render
    if (!initialVerificationComplete) {
      setInitialVerificationComplete(true);
    }
  }, [
    hasGithubConnection,
    connectionStatus,
    verifyTokenQuery,
    initialVerificationComplete,
    isVerifying,
  ]);

  // Function to manually verify token
  const verifyToken = () => {
    setIsVerifying(true);
    setVerificationError(null);
    setVerificationSuccess(false);
    verifyTokenQuery.mutate();
  };

  // Handle the disconnect button
  const handleDisconnect = () => {
    if (hasExistingProjects) {
      setIsDialogOpen(true);
    } else {
      // If no projects, we can disconnect without warning
      removeTokenMutation.mutate(undefined, {
        onSuccess: () => {
          toast.success("GitHub connection removed successfully");
          refetchStatus();
          setConnectionStatus("unknown");
          setVerificationData(null);
          setVerificationError(null);
        },
        onError: (error) => {
          toast.error(error.message || "Failed to remove GitHub connection");
        },
      });
    }
  };

  // Handle confirmed disconnect from dialog
  const handleConfirmedDisconnect = () => {
    removeTokenMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("GitHub connection removed successfully");
        refetchStatus();
        setIsDialogOpen(false);
        setConnectionStatus("unknown");
        setVerificationData(null);
        setVerificationError(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to remove GitHub connection");
      },
    });
  };

  // Decide if we should show the error state
  const showErrorState = connectionStatus === "invalid";

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (verificationSuccess) {
      const timer = setTimeout(() => {
        setVerificationSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [verificationSuccess]);

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">GitHub Integration</CardTitle>
          <CardDescription>
            Connect GitHub to access repositories and enable advanced features
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingGithub ||
          (hasGithubConnection && connectionStatus === "unknown") ? (
            <div className="flex items-center gap-2 py-2">
              <Spinner size="small" />
              <span className="text-sm text-muted-foreground">
                {isLoadingGithub
                  ? "Checking GitHub connection..."
                  : "Verifying GitHub connection..."}
              </span>
            </div>
          ) : hasGithubConnection ? (
            // Connected state - may have error
            showErrorState ? (
              // Connection error state
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>GitHub Connection Issue</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2">
                    <p>
                      {verificationError ||
                        "Your GitHub connection is no longer valid."}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => router.push("/api/github/install")}
                      >
                        <GitHubLogoIcon className=" h-4 w-4" />
                        <span>Reconnect</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleDisconnect}
                        disabled={removeTokenMutation.isPending}
                      >
                        {removeTokenMutation.isPending ? (
                          <Spinner size="small" />
                        ) : (
                          <XCircle className=" h-4 w-4" />
                        )}
                        <span>Remove Connection</span>
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ) : verificationSuccess ? (
              // Successful verification state - shows temporarily after manual verification
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>GitHub Connection Verified</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <div>
                    <span>
                      Connection is active and working properly.
                      {verificationData?.username && (
                        <span className="ml-1">
                          Connected as{" "}
                          <strong>@{verificationData.username}</strong>
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="success-outline"
                      size="sm"
                      onClick={() =>
                        window.open("/api/github/install", "_blank")
                      }
                    >
                      <Settings className=" h-3.5 w-3.5" />
                      <span>Configure</span>
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              // Standard connected state
              <Alert variant="success">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>GitHub Connected</AlertTitle>
                <AlertDescription className="flex flex-col gap-2 sm:gap-1 sm:flex-row sm:items-center justify-between">
                  <div>
                    <span>
                      GitHub App is installed. You can access private
                      repositories.
                    </span>
                    {githubData.username && (
                      <p className="text-xs opacity-90">
                        Connected as <strong>@{githubData.username}</strong>
                      </p>
                    )}
                  </div>
                  <div className="flex sm:flex-row flex-col items-center gap-2">
                    <Button
                      variant="success-outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={verifyToken}
                      disabled={isVerifying || verifyTokenQuery.isPending}
                    >
                      {isVerifying || verifyTokenQuery.isPending ? (
                        <Spinner size="small" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      <span>Verify</span>
                    </Button>
                    <Button
                      variant="success-outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() =>
                        window.open("/api/github/install", "_blank")
                      }
                    >
                      <Settings className="h-3.5 w-3.5" />
                      <span>Configure</span>
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )
          ) : (
            // Not connected state
            <div className="flex flex-col gap-3 ">
              <Alert className="mb-0">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>GitHub Not Connected</AlertTitle>
                <AlertDescription>
                  Link your GitHub account to access public and private
                  repositories, unlocking advanced features. Only one GitHub
                  account can be connected to InsightSeek.
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => router.push("/api/github/install")}
                className="shrink-0"
              >
                <GitHubLogoIcon className=" h-4 w-4" />
                <span>Install GitHub App</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove GitHub Connection?</DialogTitle>
            <DialogDescription>
              This will disconnect your GitHub account from InsightSeek.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive" className="my-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning: You have existing projects</AlertTitle>
            <AlertDescription className="text-sm">
              You have {projectCount}{" "}
              {projectCount === 1 ? "project" : "projects"} that may be
              affected. After disconnecting, you won't be able to:
              <ul className="list-disc pl-5 pt-2">
                <li>Pull new commits from private repositories</li>
                <li>Access repository metadata</li>
                <li>Create new projects from private repositories</li>
              </ul>
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmedDisconnect}
              disabled={removeTokenMutation.isPending}
            >
              {removeTokenMutation.isPending ? (
                <Spinner size="small" />
              ) : (
                <XCircle className=" h-4 w-4" />
              )}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
