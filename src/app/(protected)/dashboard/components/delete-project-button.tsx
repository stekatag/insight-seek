"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import useProject from "@/hooks/use-project";
import useRefetch from "@/hooks/use-refetch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface DeleteProjectButtonProps {
  minimal?: boolean;
}

export default function DeleteProjectButton({
  minimal = false,
}: DeleteProjectButtonProps) {
  const [open, setOpen] = useState(false);
  const deleteProject = api.project.deleteProject.useMutation();
  const { project, projectId, setProjectId } = useProject();
  const router = useRouter();
  const refetch = useRefetch();

  const handleDeleteProject = async () => {
    if (!projectId) return;

    try {
      await deleteProject.mutateAsync({ projectId });
      toast.success("Project deleted successfully");
      setOpen(false);

      // Clear selected project and redirect to dashboard
      setProjectId("");

      // Refetch projects to update the sidebar
      refetch();

      router.push("/dashboard");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete project");
    }
  };

  const handleOpenDialog = (e: React.MouseEvent) => {
    // Stop propagation to prevent the dropdown from closing
    e.stopPropagation();
    e.preventDefault();
    setOpen(true);
  };

  if (!project) return null;

  return (
    <>
      {minimal ? (
        <div
          className="flex w-full items-center"
          onClick={handleOpenDialog}
          onMouseDown={(e) => e.stopPropagation()} // Prevent dropdown mousedown event
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete Project</span>
        </div>
      ) : (
        <Button
          size="sm"
          variant="destructive"
          onClick={handleOpenDialog}
          className="flex items-center gap-1.5"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete Project</span>
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          // Only allow explicit user interactions to close the dialog
          if (open && !newOpen) {
            setOpen(false);
          }
        }}
      >
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{project.name}</span>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium">
                Warning: This action cannot be undone
              </p>
              <p className="mt-2">
                Deleting this project will permanently remove all associated
                data, including:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>All code embeddings and analysis</li>
                <li>Uploaded meetings and their transcripts</li>
                <li>Saved questions and answers</li>
                <li>Commit history and summaries</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteProject();
              }}
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? (
                <>
                  <Spinner className="text-white" size="small" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Project
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
