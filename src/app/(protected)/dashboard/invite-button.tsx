import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useProject from "@/hooks/use-project";
import { useState } from "react";
import { toast } from "sonner";

export default function InviteButton() {
  const { projectId } = useProject();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Members</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Ask them to copy and paste the following link to join the project:
        </DialogDescription>
        <Input
          className="mt-4"
          readOnly
          onClick={() => {
            navigator.clipboard.writeText(
              `${window.location.origin}/join/${projectId}`,
            );
            toast.success("Link copied to clipboard");
          }}
          value={`${window.location.origin}/join/${projectId}`}
        />
      </DialogContent>
      <Button size="sm" onClick={() => setOpen(true)}>
        Invite Team Members
      </Button>
    </Dialog>
  );
}
