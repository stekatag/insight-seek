"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { signInWithCustomToken } from "firebase/auth";
import { Trash } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { auth, deleteFile } from "@/lib/firebase";
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
  const { getToken } = useAuth();

  const handleDelete = async () => {
    try {
      // Get Firebase token with better error handling
      let firebaseToken;
      try {
        firebaseToken = await getToken({
          template: "integration_firebase",
        });

        if (!firebaseToken) {
          throw new Error("Failed to get Firebase token - token is null");
        }

        // Sign in to Firebase
        await signInWithCustomToken(auth, firebaseToken);
      } catch (authError) {
        console.error("Firebase authentication error:", authError);
        toast.error("Authentication failed. Please try again.");
        return;
      }

      // Delete the meeting in the database
      const result = await deleteMeeting.mutateAsync({ meetingId });

      // Now delete the file from Firebase Storage
      try {
        await deleteFile(result.meetingUrl, firebaseToken);
      } catch (fileError) {
        console.error(
          "Failed to delete file from Firebase Storage:",
          fileError,
        );
        toast.error(
          "Meeting data was deleted but the audio file could not be removed",
        );
      }

      toast.success("Meeting deleted successfully");
      setOpen(false);
      onDeleteSuccess();
    } catch (error) {
      console.error("Failed to delete meeting:", error);
      toast.error(
        "Failed to delete meeting. Some resources may not have been cleaned up properly.",
      );
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
                  <Spinner size="small" className="mr-2 text-white" />
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
