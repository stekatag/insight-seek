"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import useRefetch from "@/hooks/use-refetch";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";

import GitHubConnectionStatus from "./components/github-connection-status";
import ProjectCreationCard from "./components/project-creation-card";

// Updated form schema - repoUrl is now hidden
const formSchema = z.object({
  projectName: z.string().min(3, {
    message: "Project name must be at least 3 characters long",
  }),
  repoUrl: z.string().url(), // Still required but hidden from user
  branch: z.string().min(1, {
    message: "Please select a branch",
  }),
});

export type CreateProjectFormData = z.infer<typeof formSchema>;

// Create a component that uses useSearchParams
function CreatePageContent() {
  const router = useRouter();
  const { user } = useUser();
  const refetch = useRefetch();
  const searchParams = useSearchParams();

  // Check for GitHub connection status in URL params
  const githubConnected = searchParams.get("github_connected") === "true";
  const setupAction = searchParams.get("setup_action");
  const githubError = searchParams.get("error");

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectName: "",
      repoUrl: "",
      branch: "",
    },
    mode: "onChange", // This will validate on each change
  });

  // Show a toast when GitHub is connected
  useEffect(() => {
    if (githubConnected) {
      const action = setupAction === "update" ? "updated" : "connected";
      toast.success(`GitHub ${action} successfully!`);
      // Clear the URL parameter after showing the toast
      router.replace("/create");
    }

    if (githubError) {
      toast.error(
        `GitHub connection failed: ${githubError.replace(/_/g, " ")}`,
      );
      router.replace("/create");
    }
  }, [githubConnected, githubError, setupAction, router]);

  return (
    <>
      <div className="mb-8 space-y-2 text-center">
        <GitHubLogoIcon className="mx-auto h-10 w-10" />
        <h1 className="text-3xl font-bold">Create a new project</h1>
        <p className="text-muted-foreground">
          Link your GitHub repository to get started with insights
        </p>
      </div>

      {/* GitHub Connection Status Component */}
      <GitHubConnectionStatus />

      {/* Project Creation Card Component */}
      <Form {...form}>
        <ProjectCreationCard
          form={form}
          userId={user?.id}
          onSuccess={(projectId) => {
            refetch();
            router.push(`/dashboard?newProject=${projectId}`);
          }}
        />
      </Form>
    </>
  );
}

// Main component with Suspense
export default function CreatePage() {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner size="large" />
            <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <CreatePageContent />
      </Suspense>
    </div>
  );
}
