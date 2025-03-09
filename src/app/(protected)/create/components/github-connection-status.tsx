"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Github } from "lucide-react";

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
import { Spinner } from "@/components/ui/spinner";

export default function GitHubConnectionStatus() {
  const router = useRouter();

  // Check if user has GitHub App installed
  const { data: githubData, isLoading: isLoadingGithub } =
    api.user.getGithubStatus.useQuery(undefined, {
      staleTime: 10000, // Re-fetch every 10 seconds
    });

  const hasGithubConnection = !!githubData?.connected;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">GitHub Integration</CardTitle>
        <CardDescription>
          Connect GitHub to access repositories and enable advanced features
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingGithub ? (
          <div className="flex items-center gap-2 py-2">
            <Spinner size="small" />
            <span className="text-sm text-muted-foreground">
              Checking GitHub connection...
            </span>
          </div>
        ) : hasGithubConnection ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-700">GitHub Connected</AlertTitle>
            <AlertDescription className="flex items-center justify-between text-green-600">
              <span>
                GitHub App is installed. You can access private repositories.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-green-300 text-green-700"
                onClick={() => router.push("/api/github/install")}
              >
                Configure
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Alert className="mb-0">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>GitHub Not Connected</AlertTitle>
              <AlertDescription>
                Install our GitHub App to access private repositories and enable
                advanced features.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => router.push("/api/github/install")}
              className="shrink-0"
            >
              <Github className="mr-2 h-4 w-4" />
              <span>Install GitHub App</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
