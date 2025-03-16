"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { readStreamableValue } from "ai/rsc";
import { AlertTriangle, ArrowLeft, Clock } from "lucide-react";
import { toast } from "sonner";

import { adaptDatabaseQuestions, Chat } from "@/types/chat";
import { api } from "@/trpc/react";
import useRefetch from "@/hooks/use-refetch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import AskQuestionCard from "@/components/chat/ask-question-card";
import { ChatProvider, useChatContext } from "@/components/chat/chat-context";
import ChatDialog from "@/components/chat/chat-dialog";
import ChatList from "@/components/chat/chat-list";

import { askMeeting } from "../action";
import IssuesList from "./components/issues-list";

// Content component using search params
function MeetingDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const refetch = useRefetch();

  // Ensure meetingId is properly extracted as a string
  const meetingId = params.meetingId as string;

  // Use context instead of Zustand
  const { state, openDialog, addFollowUpOptimistically } = useChatContext();

  // Fetch meeting data
  const {
    data: meeting,
    isLoading: meetingLoading,
    error: meetingError,
  } = api.meeting.getMeetingById.useQuery(
    { meetingId },
    {
      enabled: !!meetingId,
      retry: 1,
    },
  );

  // Fetch chats for this meeting
  const { data: chats, isLoading: chatsLoading } =
    api.meetingChat.getMeetingChats.useQuery(
      { meetingId },
      {
        enabled: !!meetingId,
        staleTime: 0,
      },
    );

  const createMeetingChat = api.meetingChat.createMeetingChat.useMutation();
  const addFollowupQuestion = api.meetingChat.addFollowupQuestion.useMutation();
  const apiUtils = api.useUtils();

  // Check for chat ID in URL on initial load
  useEffect(() => {
    if (!chats || chatsLoading) return;

    const chatId = searchParams.get("chat");
    if (chatId) {
      const chat = chats.find((c) => c.id === chatId);
      if (chat) {
        // Open dialog with content ready to display - now with proper typing
        const chatToOpen: Chat = {
          ...chat,
          questions: adaptDatabaseQuestions(chat.questions).map((q) => ({
            ...q,
            answerLoading: false,
          })),
        };
        openDialog(chatToOpen);
      }
    }
  }, [chats, chatsLoading, searchParams, openDialog]);

  // The followup submission handler with optimistic updates
  const submitFollowUpQuestion = useCallback(
    async (question: string) => {
      if (!meetingId || !question.trim()) return;

      try {
        const { activeChat } = state;
        if (!activeChat) return;

        // Add optimistic update
        addFollowUpOptimistically(question, "Getting answer...", []);

        // Get answer from AI
        const { output } = await askMeeting(
          question,
          "", // No specific quote
          meetingId,
        );

        // Collect full answer without streaming UI updates
        let fullAnswer = "";
        for await (const delta of readStreamableValue(output)) {
          if (delta) {
            fullAnswer += delta;
          }
        }

        // Update with the complete answer once
        addFollowUpOptimistically(question, fullAnswer, []);

        // Save to the database
        await addFollowupQuestion.mutateAsync({
          chatId: activeChat.id,
          question,
          answer: fullAnswer,
        });

        // Refresh chats data
        apiUtils.meetingChat.getMeetingChats.invalidate({ meetingId });
      } catch (error) {
        console.error("Failed to process follow-up:", error);
        toast.error("Failed to get answer about the meeting");
      }
    },
    [
      meetingId,
      state, // Add missing dependency here
      addFollowupQuestion,
      apiUtils.meetingChat.getMeetingChats,
      addFollowUpOptimistically,
    ],
  );

  // Loading state
  if (meetingLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Spinner size="large" className="mb-4" />
        <p className="text-lg text-muted-foreground">Loading meeting data...</p>
      </div>
    );
  }

  // Error state
  if (meetingError || !meeting) {
    return (
      <div className="container max-w-6xl space-y-4 p-4">
        <Link href="/meetings">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Meetings
          </Button>
        </Link>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {meetingError?.message ||
              "Failed to load meeting data. The meeting may not exist."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Processing state
  if (meeting?.status === "PROCESSING") {
    return (
      <div className="container max-w-6xl space-y-4 p-4">
        <Link href="/meetings">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Meetings
          </Button>
        </Link>

        <Alert variant="info">
          <Clock className="h-4 w-4" />
          <AlertTitle>Meeting is being processed</AlertTitle>
          <AlertDescription>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Spinner
                size="medium"
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
            <h3 className="text-lg font-medium">Analyzing your meeting</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Our AI is analyzing your meeting to extract key insights, issues,
              and action items. This process typically takes 2-5 minutes for
              each minute of audio.
            </p>
            <Button
              variant="outline"
              onClick={() => refetch()}
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
      <div className="container max-w-full pb-4 sm:p-4">
        <Link href="/meetings">
          <Button variant="outline" className="mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Meetings
          </Button>
        </Link>
      </div>

      <div className="container max-w-full grid gap-6 md:grid-cols-4">
        {/* Sidebar with chat history - on the left */}
        <div className="hidden md:block">
          <div className="p-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Conversations
            </h3>
            <Separator className="mb-3" />
            {chatsLoading ? (
              <div className="flex justify-center py-4">
                <Spinner size="small" />
              </div>
            ) : (
              <ChatList chats={chats || []} variant="sidebar" />
            )}
          </div>
        </div>

        {/* Main content area - on the right */}
        <div className="md:col-span-3">
          {/* Ask Meeting Card - using the reusable component */}
          <div className="mb-8">
            <AskQuestionCard
              context="meeting"
              contextId={meetingId}
              askAction={askMeeting}
              createChatMutation={async (data) => {
                return createMeetingChat.mutateAsync({
                  meetingId: data.meetingId,
                  projectId: meeting?.projectId || "",
                  question: data.question,
                  answer: data.answer,
                });
              }}
              invalidateQueries={async () => {
                return apiUtils.meetingChat.getMeetingChats.invalidate({
                  meetingId,
                });
              }}
            />
          </div>

          {/* Meeting Issues Section */}
          <div className="mt-6">
            <Separator className="my-6" />
            <h2 className="text-2xl font-bold mb-6">Meeting Issues</h2>
            <IssuesList meetingId={meetingId} />
          </div>
        </div>
      </div>

      {/* Chat Dialog - now using the Zustand-based ChatDialog */}
      <ChatDialog
        messagesEndRef={messagesEndRef}
        onFollowUpSubmit={submitFollowUpQuestion}
      />
    </div>
  );
}

// Wrap with ChatProvider
function MeetingDetailWithProvider() {
  return (
    <ChatProvider>
      <MeetingDetailContent />
    </ChatProvider>
  );
}

// Main export wrapped in Suspense
export default function MeetingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner size="large" className="mb-4" />
          <p className="text-lg text-muted-foreground">
            Loading meeting data...
          </p>
        </div>
      }
    >
      <MeetingDetailWithProvider />
    </Suspense>
  );
}
