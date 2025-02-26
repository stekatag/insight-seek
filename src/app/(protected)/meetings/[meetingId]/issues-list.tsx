"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, RouterOutputs } from "@/trpc/react";
import { readStreamableValue } from "ai/rsc";
import { VideoIcon } from "lucide-react";
import { useState } from "react";
import { askMeeting } from "../action";
import { CollapsibleContent } from "@/components/collapsible-content";
import MarkdownRenderer from "@/components/markdown-renderer";

type Props = {
  meetingId: string;
};

export default function IssuesList({ meetingId }: Props) {
  const { data: meeting, isLoading } = api.project.getMeetingById.useQuery(
    {
      meetingId,
    },
    {
      refetchInterval: 4000,
    },
  );

  if (isLoading || !meeting) return <div>Loading...</div>;

  return (
    <div className="p-8">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-8 border-b pb-6 lg:mx-0 lg:max-w-none">
        <div className="mb-4 flex items-center gap-6">
          <div className="rounded-full border bg-white p-3">
            <VideoIcon className="h-8 w-8" />
          </div>
          <h2>
            <div className="text-sm leading-6 text-gray-600">
              Meeting on {""}
              {meeting.createdAt.toLocaleDateString()}
            </div>
            <div className="mt-1 text-base font-semibold leading-6 text-gray-900">
              {meeting.name}
            </div>
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {meeting.issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
      </div>
    </div>
  );
}

function IssueCard({
  issue,
}: {
  issue: NonNullable<
    RouterOutputs["project"]["getMeetingById"]
  >["issues"][number];
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setAnswer("");
    const { output } = await askMeeting(
      query,
      issue.summary ?? "",
      issue.meetingId,
    );
    for await (const delta of readStreamableValue(output)) {
      if (delta) {
        setAnswer((prev) => prev + delta);
      }
    }
    setIsLoading(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{issue.gist}</DialogTitle>
            <DialogDescription>
              {issue.createdAt.toLocaleDateString()}
            </DialogDescription>
            <p className="text-gray-600">{issue.headline}</p>
            <blockquote className="mt-2 border-l-4 border-gray-300 bg-gray-50 p-4 text-gray-600">
              <span className="text-sm text-gray-600">
                {issue.start} - {issue.end}
              </span>
              <p className="font-medium italic leading-relaxed text-gray-900">
                {issue.summary}
              </p>
            </blockquote>
            <form className="mt-4" onSubmit={handleSubmit}>
              <div>
                <Label>Ask for further clarification...</Label>
                <Input
                  className="mt-1"
                  placeholder="What did you mean by..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="text-xs text-gray-500">
                  Dionysus has context about this issue and the meeting
                </span>
                {answer && (
                  <>
                    <p className="mt-2 text-xs font-semibold">Answer</p>
                    <CollapsibleContent
                      maxHeight={500}
                      content={
                        <MarkdownRenderer
                          content={answer}
                          className="rounded-lg bg-white shadow-sm dark:bg-gray-800"
                        />
                      }
                    />
                  </>
                )}
              </div>
              <Button disabled={isLoading} className="mt-3 w-full">
                Ask Question
              </Button>
            </form>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <Card className="relative">
        <CardHeader>
          <CardTitle className="text-xl">{issue.gist}</CardTitle>
          <div className="border-b"></div>
          <CardDescription>{issue.headline}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)}>Details</Button>
        </CardContent>
      </Card>
    </>
  );
}
