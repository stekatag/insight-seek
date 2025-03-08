"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Clock, Loader2 } from "lucide-react";

import { api } from "@/trpc/react";
import useRefetch from "@/hooks/use-refetch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import IssuesList from "./components/issues-list";

export default function MeetingDetailPage() {
  const params = useParams();
  const refetech = useRefetch();
  const meetingId = params.meetingId as string;

  const {
    data: meeting,
    isLoading,
    error,
  } = api.meeting.getMeetingById.useQuery({ meetingId });

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Spinner size="large" className="mb-4" />
        <p className="text-lg text-muted-foreground">Loading meeting data...</p>
      </div>
    );
  }

  // Handle error state
  if (error || !meeting) {
    return (
      <div className="container mx-auto max-w-6xl space-y-4 p-4">
        <Link href="/meetings">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Meetings
          </Button>
        </Link>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error?.message ||
              "Failed to load meeting data. The meeting may not exist."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle processing state - redirect or show processing message
  if (meeting.status === "PROCESSING") {
    return (
      <div className="container mx-auto max-w-6xl space-y-4 p-4">
        <Link href="/meetings">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Meetings
          </Button>
        </Link>

        <Alert className="border-yellow-200 bg-yellow-50">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-900">
            Meeting is being processed
          </AlertTitle>
          <AlertDescription className="text-yellow-800">
            <p>
              This meeting is still being processed and is not ready to view
              yet.
            </p>
            <p className="mt-2">
              Processing can take several minutes depending on the length of
              your recording.
            </p>
          </AlertDescription>
        </Alert>

        <div className="mt-6 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-muted/40 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <Spinner size="medium" className="text-yellow-600" />
            </div>
            <h3 className="text-lg font-medium">Analyzing your meeting</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Our AI is analyzing your meeting to extract key insights, issues,
              and action items. This process typically takes 2-5 minutes for
              each minute of audio.
            </p>
            <Button
              variant="outline"
              onClick={() => refetech()}
              className="mt-2"
            >
              Refresh Status
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render actual meeting content
  return (
    <div className="flex h-full flex-col">
      <div className="container mx-auto max-w-full pb-4 sm:p-4">
        <Link href="/meetings">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Meetings
          </Button>
        </Link>
      </div>

      <IssuesList meetingId={meetingId} />
    </div>
  );
}
