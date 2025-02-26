"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useRefetch from "@/hooks/use-refetch";
import { api } from "@/trpc/react";
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
  const refetch = useRefetch();

  function onSubmit(data: FormInput) {
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
    return true;
  }

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
            <Button type="submit" disabled={createProject.isPending}>
              Create Project
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
