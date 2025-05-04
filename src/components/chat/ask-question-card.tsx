"use client";

import { FormEvent, useEffect, useReducer } from "react";
import { useSearchParams } from "next/navigation";
import { readStreamableValue } from "ai/rsc";
import { Bot, Info, Sparkles, Undo } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { chatReducer, initialChatState } from "@/components/chat/chat-reducer";
import { getQuestionsByType } from "@/components/chat/predefined-questions";

import { useChatContext } from "./chat-context";

// Generic interface for the ask card that supports both project and meeting contexts
interface AskQuestionCardProps {
  // Context can be either project or meeting
  context: "project" | "meeting";
  // ID of either project or meeting
  contextId: string;
  // Suggested questions array
  suggestedQuestions?: string[];
  // Action function that returns output and optionally filesReferences
  askAction: (
    question: string,
    quote: string,
    contextId: string,
  ) => Promise<{
    output: any;
    filesReferences?: any[];
  }>;
  // Functions for saving chat to database
  createChatMutation: (data: any) => Promise<any>;
  // Function to invalidate cache after mutations
  invalidateQueries: () => Promise<any>;
}

export default function AskQuestionCard({
  context,
  contextId,
  suggestedQuestions = [],
  askAction,
  createChatMutation,
  invalidateQueries,
}: AskQuestionCardProps) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const searchParams = useSearchParams();

  // Make sure we're extracting all needed functions from context
  const { openDialog, updateChat, updateUrl } = useChatContext();

  // Handle URL param changes for direct chat links
  useEffect(() => {
    const chatId = searchParams?.get("chat");

    // Only handle our own saved chats
    if (chatId && state.savedChat?.id === chatId) {
      // Open dialog for this saved chat
      openDialog(state.savedChat);
    }
  }, [searchParams, state.savedChat, openDialog]);

  // Function to handle initial question submission
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!contextId) return;

    if (!state.question.trim()) {
      toast.error("Please enter a question");
      return;
    }

    // Reset any existing dialog state first
    dispatch({ type: "RESET" });
    dispatch({ type: "SET_QUESTION", payload: state.question });
    dispatch({ type: "START_LOADING" });

    try {
      // First create a temp chat to show immediately
      const tempChat = {
        id: `temp-${Date.now()}`,
        title: state.question,
        questions: [
          {
            id: `temp-q-${Date.now()}`,
            question: state.question,
            answer: "Getting answer...",
            filesReferences: [],
          },
        ],
      };

      // Show the temporary chat dialog immediately
      openDialog(tempChat, true);

      // Get the answer from the API
      const { output, filesReferences = [] } = await askAction(
        state.question,
        "", // Empty quote for general questions
        contextId,
      );

      // Collect the full answer without streaming to UI
      let fullAnswer = "";
      for await (const delta of readStreamableValue(output)) {
        if (delta) {
          fullAnswer += delta;
          // Avoid frequent UI updates by not updating state during collection
        }
      }

      // Update local state with full answer at once
      dispatch({
        type: "COMPLETE_ANSWER",
        payload: {
          answer: fullAnswer,
          filesReferences,
        },
      });

      try {
        // Create a properly formatted answer object for saving
        const answerData = {
          [context === "project" ? "projectId" : "meetingId"]: contextId,
          ...(context === "meeting" ? { projectId: "" } : {}),
          question: state.question,
          answer: fullAnswer,
          filesReferences: filesReferences || [],
        };

        // Save to database
        const result = await createChatMutation(answerData);

        // Create a properly saved chat object
        const savedChat = {
          id: result.chat.id,
          title: result.chat.title,
          questions: [
            {
              id: result.question.id,
              question: state.question,
              answer: fullAnswer,
              filesReferences,
            },
          ],
        };

        // Update state with saved chat
        dispatch({
          type: "SET_SAVED_CHAT",
          payload: savedChat,
        });

        // Update the dialog with the saved chat
        updateChat(savedChat);

        // Only now update URL with chat ID (after saving)
        updateUrl(result.chat.id);

        // Refresh the chat list
        await invalidateQueries();
      } catch (error) {
        console.error("Failed to save chat:", error);
        toast.error("Failed to save chat");
        dispatch({ type: "STOP_STREAMING" });
      }
    } catch (error) {
      toast.error(
        `Failed to get an answer about the ${context}. Please try again.`,
      );
      console.error(error);
      dispatch({ type: "SET_ERROR", payload: String(error) });
    }
  }

  // Is the component currently in a loading or streaming state
  const isLoading = state.status === "loading" || state.status === "streaming";

  // Generate title and description based on context
  const cardTitle =
    context === "project"
      ? "Ask AI about this codebase"
      : "Ask AI about this meeting";

  const cardDescription =
    context === "project"
      ? "Ask about code structure, functionality, or specific files in your project"
      : "Ask about specific topics, get summaries, or analyze the key points discussed";

  // Get predefined questions based on context
  const contextType = context === "project" ? "code" : "meeting";
  const predefinedQs = getQuestionsByType(contextType);

  // Use provided questions or fall back to predefined ones
  const questions =
    suggestedQuestions.length > 0
      ? suggestedQuestions.map((text, i) => {
          // Default icon and color if predefinedQs is empty
          const defaultIcon = Info;
          const defaultColor = "text-primary";

          // Safely access the predefined questions array
          const predefinedQ =
            predefinedQs.length > 0
              ? predefinedQs[i % predefinedQs.length]
              : undefined;

          return {
            text,
            icon: predefinedQ?.icon || defaultIcon,
            color: predefinedQ?.color || defaultColor,
          };
        })
      : predefinedQs;

  return (
    <Card className="relative dark:border-secondary">
      <CardHeader className="pb-3">
        <div className="flex flex-col items-start gap-3 sm:flex-row">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">{cardTitle}</CardTitle>
            <CardDescription className="mt-1.5">
              {cardDescription}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Suggested questions */}
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {questions.map((q, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="flex h-auto items-center justify-start whitespace-normal border-primary/20 px-3 py-1.5 text-left text-xs"
                onClick={() =>
                  dispatch({
                    type: "SET_QUESTION",
                    payload: typeof q === "string" ? q : q.text,
                  })
                }
              >
                {typeof q !== "string" && q.icon && (
                  <q.icon
                    className={`h-3.5 w-3.5 ${q.color || "text-primary"}`}
                  />
                )}
                <span className="line-clamp-2">
                  {typeof q === "string" ? q : q.text}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Question Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="relative">
            <Textarea
              placeholder={
                context === "project"
                  ? "Ask about code structure, architecture, or how to implement features..."
                  : "Ask about topics discussed, decisions made, or request a meeting summary..."
              }
              value={state.question}
              required
              disabled={isLoading}
              rows={3}
              onChange={(e) =>
                dispatch({ type: "SET_QUESTION", payload: e.target.value })
              }
              className="min-h-[110px] md:min-h-[80px] resize-y pr-12"
            />
            {state.question && !isLoading && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-2 top-2 h-8 w-8 rounded-full"
                onClick={() => dispatch({ type: "SET_QUESTION", payload: "" })}
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
              <span>{isLoading ? "Processing..." : "Get AI Insights"}</span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
