"use client";

import useProject from "@/hooks/use-project";
import useRefetch from "@/hooks/use-refetch";
import { api } from "@/trpc/react";
import MeetingCard from "../dashboard/meeting-card";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  NoMeetingsEmptyState,
  NoProjectEmptyState,
} from "@/components/empty-states";
import { Check, Clock, Eye, FileQuestion, Loader2, Trash } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export default function MeetingsPage() {
  const { project, projectId } = useProject();
  const hasProject = !!project;

  const { data: meetings, isLoading } = api.project.getMeetings.useQuery(
    { projectId },
    {
      refetchInterval: 10000, // Refetch every 10 seconds to check for status changes
      enabled: hasProject,
      staleTime: 0,
    },
  );

  const deleteMeeting = api.project.deleteMeeting.useMutation();
  const refetch = useRefetch();

  // Show empty state when no project exists
  if (!hasProject) {
    return (
      <div className="space-y-6">
        <NoProjectEmptyState type="meetings" />
      </div>
    );
  }

  // Get counts for status summary
  const processingCount =
    meetings?.filter((m) => m.status === "PROCESSING").length || 0;
  const completedCount =
    meetings?.filter((m) => m.status === "COMPLETED").length || 0;

  return (
    <div className="space-y-6">
      <MeetingCard />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold">Meetings</h2>

        {meetings && meetings.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span>Analyzed: {completedCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500"></div>
              <span>Processing: {processingCount}</span>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-lg border py-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading meetings...</span>
          </div>
        </div>
      ) : meetings && meetings.length === 0 ? (
        <NoMeetingsEmptyState />
      ) : (
        <div className="rounded-lg border bg-card">
          <ul className="divide-y divide-border">
            {meetings?.map((meeting) => {
              const isProcessing = meeting.status === "PROCESSING";
              const issueCount = meeting.issues.length;

              return (
                <li
                  key={meeting.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium">
                        {meeting.name}
                      </span>
                      {isProcessing ? (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <Badge className="cursor-help bg-yellow-500 hover:bg-yellow-600">
                              <Clock className="mr-1 h-3 w-3" />
                              Processing...
                            </Badge>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80">
                            <div className="flex justify-between space-y-1">
                              <h4 className="text-sm font-semibold">
                                Processing In Progress
                              </h4>
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                      ) : (
                        <Badge className="bg-green-500 hover:bg-green-600">
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
                          },
                        )}
                      </span>
                      {!isProcessing && (
                        <span className="inline-flex items-center">
                          <FileQuestion className="mr-1 h-3.5 w-3.5" />
                          {issueCount} {issueCount === 1 ? "issue" : "issues"}{" "}
                          identified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            {" "}
                            {/* Wrapper div to control tooltip behavior */}
                            {isProcessing ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={true}
                                className="w-24"
                              >
                                <Eye className="mr-1.5 h-4 w-4" />
                                View
                              </Button>
                            ) : (
                              <Link href={`/meetings/${meeting.id}`}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-24"
                                >
                                  <Eye className="mr-1.5 h-4 w-4" />
                                  View
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isProcessing
                            ? "Meeting is still being analyzed"
                            : "View meeting details and insights"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="w-24"
                            disabled={deleteMeeting.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Are you sure you want to delete this meeting?",
                                )
                              ) {
                                deleteMeeting.mutate(
                                  { meetingId: meeting.id },
                                  {
                                    onSuccess: () => {
                                      toast.success(
                                        "Meeting deleted successfully!",
                                      );
                                      refetch();
                                    },
                                    onError: () => {
                                      toast.error("Failed to delete meeting");
                                    },
                                  },
                                );
                              }
                            }}
                          >
                            {deleteMeeting.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Trash className="mr-1.5 h-4 w-4" />
                                Delete
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Delete this meeting and all its data
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
