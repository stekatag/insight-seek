import Link from "next/link";
import { FileQuestion, Folder, Plus, Presentation } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ProjectSelector } from "./project-selector";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    href: string;
  };
};

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-muted/40">
      <CardHeader className="flex flex-row items-center gap-4 space-y-0">
        {icon}
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      {action && (
        <CardFooter className="border-t pb-6 pt-6">
          <Link href={action.href} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4" /> {action.label}
            </Button>
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

export function NoProjectEmptyState({
  type,
}: {
  type: "questions" | "meetings";
}) {
  return (
    <div className="flex flex-col gap-6 rounded-lg border border-dashed bg-muted/40 p-8">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/60">
          <Folder className="h-10 w-10 text-muted-foreground" />
        </div>

        <h3 className="mt-5 text-xl font-semibold">No Project Selected</h3>
        <p className="mb-6 mt-2 max-w-md text-base text-muted-foreground">
          Select an existing project or create a new one to{" "}
          {type === "questions" ? "start asking questions" : "upload meetings"}.
        </p>

        <div className="mx-auto w-full max-w-sm">
          <ProjectSelector />
        </div>
      </div>
    </div>
  );
}

export function NoQuestionsEmptyState() {
  return (
    <EmptyState
      title="No chats yet"
      description="Ask your first question about this project to get started."
      icon={<FileQuestion className="h-8 w-8 text-muted-foreground" />}
    />
  );
}

export function NoMeetingsEmptyState() {
  return (
    <div className="rounded-lg border border-dashed bg-muted/40 p-8 text-center">
      <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Presentation className="h-10 w-10 text-primary/80" />
        </div>

        <h3 className="mt-6 text-xl font-semibold">No meetings yet</h3>
        <p className="mb-4 mt-2 text-base text-muted-foreground">
          Upload your first meeting recording to get AI-powered insights and
          action items.
        </p>

        <div className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="rounded-md border dark:border-secondary bg-muted/50 dark:bg-card p-3">
            <p className="font-medium text-foreground">How it works:</p>
            <ol className="ml-5 mt-2 list-decimal text-left">
              <li>Upload your meeting recording (audio file)</li>
              <li>Our AI transcribes and analyzes the content</li>
              <li>Review AI-generated insights and action items</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
