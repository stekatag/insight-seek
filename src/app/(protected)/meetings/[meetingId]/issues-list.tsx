"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, RouterOutputs } from "@/trpc/react";
import { readStreamableValue } from "ai/rsc";
import {
  ArrowUpRight,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  VideoIcon,
  CircleAlert,
} from "lucide-react";
import { useState } from "react";
import { askMeeting } from "../action";
import { CollapsibleContent } from "@/components/collapsible-content";
import MarkdownRenderer from "@/components/markdown-renderer";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatDuration } from "@/lib/format-duration";

type Props = {
  meetingId: string;
};

export default function IssuesList({ meetingId }: Props) {
  const { data: meeting, isLoading } = api.project.getMeetingById.useQuery({
    meetingId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[200px] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center">
        <CircleAlert className="mb-4 h-12 w-12 text-yellow-500" />
        <h2 className="text-xl font-semibold">Meeting not found</h2>
        <p className="text-muted-foreground">
          The meeting you requested doesn't exist or has been deleted.
        </p>
      </div>
    );
  }

  // Group issues by common themes or similarity if needed
  const issues = meeting.issues;

  return (
    <div className="sm:p-4">
      {/* Meeting header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 border-b pb-6 sm:flex-row sm:items-center">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <VideoIcon className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {meeting.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center">
                <Clock className="mr-1 h-4 w-4" />
                {new Date(meeting.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <Badge variant="outline">
                {issues.length} {issues.length === 1 ? "issue" : "issues"}{" "}
                identified
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Issues grid */}
      {issues.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      ) : (
        <div className="flex h-[40vh] flex-col items-center justify-center rounded-lg border border-dashed">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/60" />
          <h3 className="text-lg font-medium">No issues identified</h3>
          <p className="mt-1 text-center text-muted-foreground">
            No significant issues were identified in this meeting.
            <br />
            Try asking specific questions about the content.
          </p>
        </div>
      )}
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
  const isMobile = useIsMobile();

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setAnswer("");

    try {
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
    } catch (error) {
      console.error("Error asking meeting:", error);
      setAnswer("Sorry, there was an error processing your request.");
    } finally {
      setIsLoading(false);
    }
  };

  // Extract time range for better display
  const timeRange = `${issue.start} - ${issue.end}`;

  const IssueDetail = (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-lg font-medium">Key Issue</h3>
          <p className="text-sm text-muted-foreground">{issue.headline}</p>
        </div>

        <div>
          <h3 className="mb-2 text-lg font-medium">Summary</h3>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm italic leading-relaxed">{issue.summary}</p>
          </div>
        </div>

        <Separator className="my-2" />

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="query" className="text-sm font-medium">
              Ask follow-up question
            </Label>
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <Input
                id="query"
                placeholder="Ask for clarification or more details..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isLoading || !query.trim()}
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
                <span>Ask</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The AI has context about this issue and the full meeting content
            </p>
          </div>

          {answer && (
            <div className="rounded-md border p-4">
              <h4 className="mb-2 text-sm font-medium">Response</h4>
              <CollapsibleContent
                maxHeight={300}
                content={
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MarkdownRenderer content={answer} />
                  </div>
                }
              />
            </div>
          )}
        </form>
      </div>
    </>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <div className="max-h-[85vh] overflow-y-auto">
              <DrawerHeader className="text-left">
                <DrawerTitle className="pr-6">{issue.gist}</DrawerTitle>
                <DrawerDescription>
                  {formatDuration(issue.start, issue.end)}
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4">{IssueDetail}</div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
            <DialogHeader>
              <DialogTitle className="pr-6">{issue.gist}</DialogTitle>
              <DialogDescription>
                {formatDuration(issue.start, issue.end)}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <div className="px-4 pb-6">{IssueDetail}</div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      <Card className="group h-full overflow-hidden transition-all hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="line-clamp-2 text-xl">{issue.gist}</CardTitle>
          </div>
          <CardDescription className="line-clamp-1 font-mono text-xs">
            {timeRange}
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {issue.headline}
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={() => setOpen(true)}>
            <span>View Details</span>
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
