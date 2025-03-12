"use client";

import { FormEvent, useCallback, useEffect, useReducer, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readStreamableValue } from "ai/rsc";
import { Bot, Sparkles, Undo } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import useProject from "@/hooks/use-project";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import ChatDialog from "@/components/chat/chat-dialog";
import { askQuestion } from "@/app/(protected)/dashboard/actions";

import { chatReducer, initialChatState } from "./chat-reducer";
import { predefinedQuestions } from "./predefined-questions";

export default function AskQuestionCard() {
  const { project } = useProject();
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const router = useRouter();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // API mutations
  const createChat = api.qa.createChat.useMutation();
  const addFollowUpQuestion = api.qa.addFollowupQuestion.useMutation();

  // Get the active chat (either saved or temporary)
  const activeChat = state.savedChat || state.tempChat;

  // Check for 'ask' parameter to pre-fill the question input
  useEffect(() => {
    const askParam = searchParams.get("ask");
    if (askParam) {
      dispatch({ type: "SET_QUESTION", payload: decodeURIComponent(askParam) });
    }
  }, [searchParams]);

  // Function to select a predefined question
  const selectPredefinedQuestion = (question: string) => {
    dispatch({ type: "SET_QUESTION", payload: question });
  };

  // Handler for follow-up question changes
  const handleFollowUpChange = useCallback((value: string) => {
    dispatch({ type: "SET_FOLLOW_UP", payload: value });
  }, []);

  // Handler for follow-up question submission
  const handleFollowUpSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      const { followUpQuestion, isStreaming } = state;

      if (
        !followUpQuestion.trim() ||
        isStreaming ||
        !project?.id ||
        !activeChat
      )
        return;

      // Set streaming state immediately
      dispatch({ type: "START_FOLLOW_UP_STREAMING" });

      try {
        // Get answer from AI
        const { output, filesReferences } = await askQuestion(
          followUpQuestion,
          project.id,
        );

        // Stream the answer in real-time
        let fullAnswer = "";
        for await (const delta of readStreamableValue(output)) {
          if (delta) {
            fullAnswer += delta;
            dispatch({ type: "SET_STREAM_CONTENT", payload: fullAnswer });
          }
        }

        // If we have a saved chat in the database, save the follow-up there
        if (state.savedChat) {
          await addFollowUpQuestion.mutateAsync({
            chatId: state.savedChat.id,
            question: followUpQuestion,
            answer: fullAnswer,
            filesReferences,
          });
        }

        // Update the state with the new Q&A
        dispatch({
          type: "ADD_FOLLOW_UP_ANSWER",
          payload: {
            question: followUpQuestion,
            answer: fullAnswer,
            filesReferences,
          },
        });
      } catch (error) {
        console.error("Failed to process follow-up:", error);
        toast.error("Failed to get answer to follow-up question");
        dispatch({ type: "STOP_STREAMING" });
      }
    },
    [state, project?.id, activeChat, addFollowUpQuestion],
  );

  // Function to handle initial question submission
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!project?.id) return;
    if (!state.question.trim()) {
      toast.error("Please enter a question");
      return;
    }

    dispatch({ type: "START_LOADING" });

    try {
      // Get the answer from the API
      const { output, filesReferences } = await askQuestion(
        state.question,
        project.id,
      );

      // Add project ID to references
      const enhancedReferences = filesReferences.map((ref) => ({
        ...ref,
        projectId: project.id,
      }));

      // Process streaming response
      let fullAnswer = "";
      for await (const delta of readStreamableValue(output)) {
        if (delta) {
          fullAnswer += delta;
          dispatch({
            type: "STREAM_ANSWER",
            payload: {
              content: fullAnswer,
              filesReferences: enhancedReferences,
            },
          });
        }
      }

      // Validate answer
      if (fullAnswer.trim() === "#" || fullAnswer.trim() === "") {
        toast.error("Generated answer was invalid. Please try again.");
        dispatch({ type: "SET_ERROR", payload: "Invalid response" });
        return;
      }

      // Complete the answer
      dispatch({ type: "COMPLETE_ANSWER", payload: fullAnswer });

      try {
        // Save to database
        const result = await createChat.mutateAsync({
          projectId: project.id,
          question: state.question,
          answer: fullAnswer,
          filesReferences: enhancedReferences,
        });

        // Update state with saved chat
        dispatch({
          type: "SET_SAVED_CHAT",
          payload: {
            id: result.chat.id,
            title: result.chat.title,
            questions: [
              {
                id: result.question.id,
                question: state.question,
                answer: fullAnswer,
                filesReferences: enhancedReferences,
              },
            ],
          },
        });

        // Update URL AFTER we've successfully saved the chat
        const params = new URLSearchParams(searchParams.toString());
        params.set("chat", result.chat.id);
        router.replace(`?${params.toString()}`, { scroll: false });
      } catch (error) {
        console.error("Failed to save chat:", error);
        toast.error("Failed to save chat");
        dispatch({ type: "STOP_STREAMING" });
      }
    } catch (error) {
      toast.error("Failed to get an answer. Please try again.");
      console.error(error);
      dispatch({ type: "SET_ERROR", payload: String(error) });
    }
  }

  // Function to handle dialog state changes
  const handleDialogChange = (isOpen: boolean) => {
    dispatch({ type: "SET_DIALOG_OPEN", payload: isOpen });

    // If closing the dialog, clean up URL parameter
    if (!isOpen) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("chat")) {
        url.searchParams.delete("chat");
        router.replace(url.pathname + url.search, { scroll: false });
      }
    }
  };

  // Is the component currently in a loading or streaming state
  const isLoading = state.status === "loading" || state.status === "streaming";

  return (
    <>
      {/* ChatDialog - Only render when we have a chat to display */}
      {activeChat && (
        <ChatDialog
          isOpen={state.isDialogOpen}
          setIsOpen={handleDialogChange}
          activeChat={activeChat}
          title={state.question}
          followUpQuestion={state.followUpQuestion}
          isStreaming={state.isStreaming}
          streamContent={state.streamContent}
          messagesEndRef={messagesEndRef}
          onFollowUpChange={handleFollowUpChange}
          onFollowUpSubmit={handleFollowUpSubmit}
        />
      )}

      {/* Question Card */}
      <Card className="relative col-span-1 sm:col-span-3 dark:border-secondary">
        <CardHeader className="pb-3">
          <div className="flex flex-col items-start gap-3 sm:flex-row">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">
                Ask AI anything about your repo
              </CardTitle>
              <CardDescription className="mt-1.5">
                InsightSeek knows everything about your GitHub repository. Ask
                away!
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Predefined Questions */}
          <div className="mb-4">
            <Badge
              variant="outline"
              className="mb-2 items-center gap-1 bg-muted/50 py-1 text-xs font-normal text-muted-foreground"
            >
              Try asking:
            </Badge>
            <div className="flex flex-wrap gap-2">
              {predefinedQuestions.map((q, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="flex h-auto items-center justify-start whitespace-normal border-primary/20 px-3 py-1.5 text-left text-xs"
                  onClick={() => selectPredefinedQuestion(q.text)}
                >
                  <q.icon className={cn("h-3.5 w-3.5 shrink-0", q.color)} />
                  <span className="line-clamp-2">{q.text}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Question Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative">
              <Textarea
                placeholder="Ask a question about your code or repository..."
                value={state.question}
                required
                disabled={isLoading}
                rows={3}
                onChange={(e) =>
                  dispatch({ type: "SET_QUESTION", payload: e.target.value })
                }
                className="min-h-[80px] resize-y pr-12"
              />
              {state.question && !isLoading && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-2 h-8 w-8 rounded-full"
                  onClick={() =>
                    dispatch({ type: "SET_QUESTION", payload: "" })
                  }
                >
                  <Undo className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex sm:justify-end">
              <Button type="submit" disabled={isLoading} className="gap-1.5">
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>{isLoading ? "Processing..." : "Ask InsightSeek"}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
