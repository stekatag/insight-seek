"use client";

import { FormEvent, useState } from "react";
import { readStreamableValue } from "ai/rsc";
import {
  Bot,
  BrainCircuit,
  FileSearch,
  Info,
  Lightbulb,
  Sparkles,
  Undo,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import useProject from "@/hooks/use-project";
import useRefetch from "@/hooks/use-refetch";
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
import { askQuestion } from "@/app/(protected)/dashboard/actions";
import AnswerDisplay from "@/app/(protected)/dashboard/components/answer-display";

// Predefined questions with icons remain unchanged
const predefinedQuestions = [
  {
    text: "What can I ask about this repo?",
    icon: Info,
    color: "text-blue-500",
  },
  {
    text: "Give me a brief summary of this project",
    icon: FileSearch,
    color: "text-purple-500",
  },
  {
    text: "What are the main components?",
    icon: BrainCircuit,
    color: "text-green-500",
  },
  {
    text: "What technologies does this project use?",
    icon: Lightbulb,
    color: "text-amber-500",
  },
  {
    text: "How is the code organized?",
    icon: FileSearch,
    color: "text-indigo-500",
  },
];

export default function AskQuestionCard() {
  const { project } = useProject();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [filesReferences, setFilesReferences] = useState<
    { fileName: string; sourceCode: string; summary: string }[]
  >([]);
  const [answer, setAnswer] = useState("");
  const saveAnswer = api.qa.saveAnswer.useMutation();
  const refetch = useRefetch();

  const selectPredefinedQuestion = (question: string) => {
    setQuestion(question);
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    setAnswer("");
    setFilesReferences([]);
    e.preventDefault();

    if (!project?.id) return;
    if (!question.trim()) {
      toast.error("Please enter a question");
      return;
    }

    setLoading(true);

    try {
      const { output, filesReferences } = await askQuestion(
        question,
        project.id,
      );
      setOpen(true);
      setFilesReferences(filesReferences);

      for await (const delta of readStreamableValue(output)) {
        if (delta) {
          setAnswer((ans) => ans + delta);
        }
      }
    } catch (error) {
      toast.error("Failed to get an answer. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const handleSaveAnswer = () => {
    if (!project?.id) return;

    saveAnswer.mutate(
      {
        projectId: project.id,
        question,
        answer,
        filesReferences,
      },
      {
        onSuccess: () => {
          toast.success("Answer saved successfully");
          refetch();
        },
        onError: (error) => {
          toast.error("Failed to save answer");
          console.error(error);
        },
      },
    );
  };

  return (
    <>
      {/* Answer Display Component */}
      <AnswerDisplay
        open={open}
        setOpen={setOpen}
        question={question}
        answer={answer}
        filesReferences={filesReferences}
        onSave={handleSaveAnswer}
        isSaving={saveAnswer.isPending}
      />

      {/* Question Card with Enhanced UI */}
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
          {/* Predefined Questions - Updated for better responsiveness */}
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
                value={question}
                required
                rows={3}
                onChange={(e) => setQuestion(e.target.value)}
                className="min-h-[80px] resize-y pr-12"
              />
              {question && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-2 h-8 w-8 rounded-full"
                  onClick={() => setQuestion("")}
                >
                  <Undo className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex sm:justify-end">
              <Button type="submit" disabled={loading} className="gap-1.5">
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>{loading ? "Processing..." : "Ask InsightSeek"}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
