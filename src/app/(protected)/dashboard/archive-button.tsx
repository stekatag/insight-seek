"use clinet";

import { Button } from "@/components/ui/button";
import useProject from "@/hooks/use-project";
import useRefetch from "@/hooks/use-refetch";
import { api } from "@/trpc/react";
import { toast } from "sonner";

export default function ArchiveButton() {
  const archiveProject = api.project.archiveProject.useMutation();
  const { projectId } = useProject();
  const refetch = useRefetch();

  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={archiveProject.isPending}
      onClick={() => {
        const confirm = window.confirm(
          "Are you sure you want to archive this project?",
        );
        if (confirm) {
          archiveProject.mutate(
            { projectId },
            {
              onSuccess: () => {
                toast.success("Project archived successfully");
                refetch();
              },
              onError: (error) => {
                console.error(error);
                toast.error(error.message);
              },
            },
          );
        }
      }}
    >
      Archive Project
    </Button>
  );
}
