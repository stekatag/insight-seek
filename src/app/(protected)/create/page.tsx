"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useRefetch from "@/hooks/use-refetch";
import { createCheckoutSession } from "@/lib/stripe";
import { api } from "@/trpc/react";
import { AlertTriangle, Info } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type FormInput = {
  repoUrl: string;
  projectName: string;
  githubToken?: string;
};

export default function CreatePage() {
  const { register, handleSubmit, reset } = useForm<FormInput>();
  const createProject = api.project.createProject.useMutation();
  const checkCredits = api.project.checkCredits.useMutation();
  const refetch = useRefetch();

  function onSubmit(data: FormInput) {
    if (!!checkCredits.data) {
      createProject.mutate(
        {
          githubUrl: data.repoUrl,
          name: data.projectName,
          githubToken: data.githubToken,
        },
        {
          onSuccess: () => {
            toast.success("Project created successfully");
            refetch();
            reset();
          },
          onError: (error) => {
            toast.error("Failed to create project");
            console.error(error);
          },
        },
      );
    } else {
      checkCredits.mutate({
        githubUrl: data.repoUrl,
        githubToken: data.githubToken,
      });
    }
  }

  const hasEnoughCredits = checkCredits.data?.userCredits
    ? checkCredits.data.fileCount <= checkCredits.data.userCredits
    : true;

  return (
    <div className="flex h-full items-center justify-center gap-12">
      <img
        src="/undraw_github.svg"
        className="h-56 w-auto"
        alt="Github developer illustration"
      />
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">
            Link Your GitHub Repository
          </h2>
          <p className="text-sm text-muted-foreground">
            Enter the URL of your GitHub repository to link it in InsightSeek
          </p>
        </div>
        <div>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <Input
              {...register("projectName", { required: true })}
              placeholder="Project Name"
            />
            <Input
              {...register("repoUrl", { required: true })}
              placeholder="GitHub Repository URL"
            />
            <Input
              {...register("githubToken")}
              placeholder="GitHub Token (Optional) for private repositories"
            />

            {!!checkCredits.data && (
              <>
                <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-2 text-orange-700">
                  <div className="flex items-center gap-2">
                    <Info className="size-4" />
                    <p className="text-sm">
                      You will be charged
                      <strong>{checkCredits.data?.fileCount}</strong> credits
                      for this repository.
                    </p>
                  </div>
                  <p className="ml-6 text-sm text-blue-600">
                    You have <strong>{checkCredits.data?.userCredits}</strong>{" "}
                    credits remaining.
                  </p>
                </div>
                {!hasEnoughCredits && (
                  <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-red-700">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4" />
                      <p className="text-sm text-red-500">
                        You do not have enough credits to create this project.
                      </p>
                    </div>
                    <div className="h-2"></div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        createCheckoutSession(
                          checkCredits.data?.fileCount -
                            checkCredits.data?.userCredits,
                        )
                      }
                    >
                      Buy{" "}
                      {checkCredits.data?.fileCount -
                        checkCredits.data?.userCredits}{" "}
                      Credits
                    </Button>
                  </div>
                )}
              </>
            )}

            <Button
              type="submit"
              disabled={
                createProject.isPending ||
                checkCredits.isPending ||
                !hasEnoughCredits
              }
            >
              {!!checkCredits.data ? "Create Project" : "Check Credits"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
