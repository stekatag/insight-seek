"use client";

import { useState } from "react";
import { Loader2, Trash } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
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

interface DeleteMeetingButtonProps {
  meetingId: string;
  meetingName: string;
  onDeleteSuccess: () => void;
}

export default function DeleteMeetingButton({
  meetingId,
  meetingName,
  onDeleteSuccess,
}: DeleteMeetingButtonProps) {
  const [open, setOpen] = useState(false);
  const deleteMeeting = api.meeting.deleteMeeting.useMutation();

  const handleDelete = async () => {
    try {
      await deleteMeeting.mutateAsync({ meetingId });
      toast.success("Meeting deleted successfully");
      setOpen(false);
      onDeleteSuccess();
    } catch (error) {
      console.error("Failed to delete meeting:", error);
      toast.error("Failed to delete meeting. Please try again.");
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="destructive"
        className="w-24"
        onClick={() => setOpen(true)}
      >
        <Trash className="mr-1.5 h-4 w-4" />
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Meeting</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{meetingName}</span>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium">This action cannot be undone</p>
              <p className="mt-2">
                Deleting this meeting will remove all associated data, including
                transcripts, analyses, and identified issues.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMeeting.isPending}
            >
              {deleteMeeting.isPending ? (
                <>
                  <Spinner size="small" className="mr-2" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash className="mr-2 h-4 w-4" />
                  <span>Delete Meeting</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
