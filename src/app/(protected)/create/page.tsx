"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useRefetch from "@/hooks/use-refetch";
import { createCheckoutSession } from "@/lib/stripe";
import { api } from "@/trpc/react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Github,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

const formSchema = z.object({
  projectName: z.string().min(3, {
    message: "Project name must be at least 3 characters long",
  }),
  repoUrl: z
    .string()
    .url({
      message: "Please enter a valid URL",
    })
    .refine((url) => url.includes("github.com"), {
      message: "URL must be a GitHub repository",
    }),
  githubToken: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function CreatePage() {
  const router = useRouter();
  const refetch = useRefetch();

  const [validationState, setValidationState] = useState<
    "idle" | "validating" | "validated" | "error"
  >("idle");
  const [validationError, setValidationError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectName: "",
      repoUrl: "",
      githubToken: "",
    },
  });

  const createProject = api.project.createProject.useMutation({
    onSuccess: () => {
      toast.success("Project created successfully!");
      refetch();
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create project");
      setValidationState("error");
      setValidationError(error.message || "Failed to create project");
    },
  });

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

  async function onSubmit(data: FormData) {
    if (validationState === "validated" && checkCredits.data) {
      // Proceed with project creation
      createProject.mutate({
        githubUrl: data.repoUrl,
        name: data.projectName,
        githubToken: data.githubToken || undefined,
      });
      return;
    }

    // Otherwise, validate the repo first
    setValidationState("validating");
    setValidationError(null);

    checkCredits.mutate({
      githubUrl: data.repoUrl,
      githubToken: data.githubToken || undefined,
    });
  }

  const hasEnoughCredits = checkCredits.data?.userCredits
    ? checkCredits.data.fileCount <= checkCredits.data.userCredits
    : true;

  // Create a function to reset the validation state
  const resetValidation = () => {
    setValidationState("idle");
    setValidationError(null);
    checkCredits.reset();
  };

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-8 space-y-2 text-center">
        <Github className="mx-auto h-10 w-10" />
        <h1 className="text-3xl font-bold">Create a new project</h1>
        <p className="text-muted-foreground">
          Link your GitHub repository to get started with insights
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Enter your project name and GitHub repository URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              id="project-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6"
            >
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

              <FormField
                control={form.control}
                name="repoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GitHub Repository URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://github.com/username/repository"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          resetValidation();
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter the full URL to your GitHub repository.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="githubToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GitHub Token (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ghp_xxx..."
                        type="password"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          resetValidation();
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Required for private repositories.
                      <a
                        href="https://github.com/settings/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 inline-flex items-center text-primary hover:underline"
                      >
                        Create a token{" "}
                        <ExternalLink className="ml-0.5 h-3 w-3" />
                      </a>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Validation states */}
              {validationState === "validating" && (
                <Alert className="bg-blue-50">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <AlertTitle>Validating repository...</AlertTitle>
                  <AlertDescription>
                    Please wait while we check your GitHub repository.
                  </AlertDescription>
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
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertTitle className="text-green-700">
                    Repository validated successfully
                  </AlertTitle>
                  <AlertDescription className="text-green-600">
                    {checkCredits.data.repoName} is ready to be indexed.
                    {checkCredits.data.isPrivate && " (Private repository)"}
                  </AlertDescription>
                </Alert>
              )}

              {validationState === "validated" && checkCredits.data && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Credit Information</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-1 text-sm">
                      <p>
                        Files to index:{" "}
                        <strong>{checkCredits.data.fileCount}</strong>
                      </p>
                      <p>
                        Your credits:{" "}
                        <strong>{checkCredits.data.userCredits}</strong>
                      </p>
                      {!hasEnoughCredits && (
                        <p className="text-red-500">
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
          </Form>
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            disabled={createProject.isPending}
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </Button>

          <div className="flex gap-2">
            {!hasEnoughCredits && validationState === "validated" && (
              <Link href="/billing">
                <Button disabled={createProject.isPending}>
                  <CreditCard className="h-4 w-4" />
                  <span>Buy Credits</span>
                </Button>
              </Link>
            )}

            <Button
              type="submit"
              form="project-form"
              disabled={
                createProject.isPending ||
                checkCredits.isPending ||
                (validationState === "validated" && !hasEnoughCredits)
              }
            >
              {validationState === "idle" || validationState === "error"
                ? "Validate Repository"
                : "Create Project"}
              {(createProject.isPending || checkCredits.isPending) && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
