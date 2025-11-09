"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock, Eye, FileQuestion } from "lucide-react";
import { useTheme } from "next-themes";

import { api } from "@/trpc/react";
import useRefetch from "@/hooks/use-refetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NoMeetingsEmptyState } from "@/components/empty-states";
import MeetingCard from "@/components/meeting-card";

import DeleteMeetingButton from "./components/delete-meeting-button";

export default function MeetingsPage() {
  const refetch = useRefetch();
  const { resolvedTheme } = useTheme();

  // State to track whether we should be polling actively
  const [shouldPoll, setShouldPoll] = useState(false);

  // Define different polling intervals
  const ACTIVE_POLL_INTERVAL = 15000; // 15 seconds when processing
  const NO_POLLING = false; // Disable polling when no processing meetings

  const { data: meetings, isLoading } = api.meeting.getMeetings.useQuery(
    undefined,
    {
      enabled: true,
      refetchInterval: shouldPoll ? ACTIVE_POLL_INTERVAL : NO_POLLING,
      staleTime: 0,
      refetchOnMount: true,
    },
  );

  // Update polling state whenever meetings data changes
  useEffect(() => {
    if (meetings) {
      // Check if any meetings are in PROCESSING status
      const hasProcessingMeetings = meetings.some(
        (meeting) => meeting.status === "PROCESSING",
      );

      // Update the polling state
      setShouldPoll(hasProcessingMeetings);
    }
  }, [meetings]);

  // Get counts for status summary
  const processingCount =
    meetings?.filter((m) => m.status === "PROCESSING").length || 0;
  const completedCount =
    meetings?.filter((m) => m.status === "COMPLETED").length || 0;
  const errorCount = meetings?.filter((m) => m.status === "ERROR").length || 0;

  const handleDeleteSuccess = () => {
    // Refetch meetings after successful deletion
    refetch();
  };

  return (
    <div className="space-y-6">
      <MeetingCard />

      <div className="mt-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold">My Meetings</h2>

        {meetings && meetings.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-600"></div>
              <span>Analyzed: {completedCount}</span>
            </div>
            {processingCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-600"></div>
                <span>Processing: {processingCount}</span>
              </div>
            )}
            {errorCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-600"></div>
                <span>Failed: {errorCount}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-lg border py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner size="medium" />
            <span>Loading meetings...</span>
          </div>
        </div>
      ) : meetings && meetings.length === 0 ? (
        <NoMeetingsEmptyState />
      ) : (
        <div className="rounded-lg border dark:border-secondary bg-card">
          <ul className="divide-y divide-border dark:divide-secondary">
            {meetings?.map((meeting) => {
              const isProcessing = meeting.status === "PROCESSING";
              const isError = meeting.status === "ERROR";
              const issueCount = meeting.issues.length;

              return (
                <li
                  key={meeting.id}
                  className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex items-start md:items-center flex-col md:flex-row gap-2 mb-3 md:mb-0">
                      <span className="text-base font-medium">
                        {meeting.name}
                      </span>
                      {isProcessing ? (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <Badge className="cursor-help bg-yellow-600 hover:bg-yellow-700">
                              <Clock className="mr-1 h-3 w-3" />
                              Processing...
                            </Badge>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80">
                            <div className="flex justify-between space-y-1">
                              <h4 className="text-sm font-semibold">
                                Processing In Progress
                              </h4>
                              <Spinner
                                size="small"
                                className="text-muted-foreground"
                              />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Your meeting is being analyzed. This can take
                              several minutes depending on the length of the
                              recording.
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              This page will automatically update when
                              processing is complete.
                            </p>
                          </HoverCardContent>
                        </HoverCard>
                      ) : isError ? (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <Badge
                              variant="destructive"
                              className="cursor-help"
                            >
                              Failed
                            </Badge>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80">
                            <div className="space-y-1">
                              <h4 className="text-sm font-semibold">
                                Processing Failed
                              </h4>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              There was an error processing this meeting. Please
                              try uploading it again.
                            </p>
                          </HoverCardContent>
                        </HoverCard>
                      ) : (
                        <Badge variant="success">
                          <Check className="mr-1 h-3 w-3" />
                          Analyzed
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center">
                        <Clock className="mr-1 h-3.5 w-3.5" />
                        {new Date(meeting.createdAt).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                      {!isProcessing && !isError && (
                        <span className="inline-flex items-center">
                          <FileQuestion className="mr-1 h-3.5 w-3.5" />
                          {issueCount} {issueCount === 1 ? "issue" : "issues"}{" "}
                          identified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                      <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            {isProcessing || isError ? (
                              <Button
                                size="sm"
                                variant={
                                  resolvedTheme === "dark"
                                    ? "secondary"
                                    : "outline"
                                }
                                disabled={true}
                                className="w-24"
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                            ) : (
                              <Link href={`/meetings/${meeting.id}`}>
                                <Button
                                  size="sm"
                                  variant={
                                    resolvedTheme === "dark"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  className="w-24"
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isProcessing
                            ? "Meeting is still being analyzed"
                            : isError
                              ? "Processing failed for this meeting"
                              : "View meeting details and insights"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <DeleteMeetingButton
                      meetingId={meeting.id}
                      meetingName={meeting.name}
                      onDeleteSuccess={handleDeleteSuccess}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
