"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import useProject from "@/hooks/use-project";
import { Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { askQuestion } from "./actions";
import { readStreamableValue } from "ai/rsc";
import CodeReferences from "./code-references";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import useRefetch from "@/hooks/use-refetch";
import { useIsMobile } from "@/hooks/use-mobile";
import MarkdownRenderer from "@/components/markdown-renderer";
import { CollapsibleContent } from "@/components/collapsible-content";

export default function AskQuestionCard() {
  const { project } = useProject();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [filesReferences, setFilesReferences] = useState<
    { fileName: string; sourceCode: string; summary: string }[]
  >([]);
  const [answer, setAnswer] = useState("");
  const saveAnswer = api.project.saveAnswer.useMutation();
  const refetch = useRefetch();
  const isMobile = useIsMobile();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    setAnswer("");
    setFilesReferences([]);
    e.preventDefault();

    if (!project?.id) return;

    setLoading(true);

    const { output, filesReferences } = await askQuestion(question, project.id);
    setOpen(true);
    setFilesReferences(filesReferences);

    for await (const delta of readStreamableValue(output)) {
      if (delta) {
        setAnswer((ans) => ans + delta);
      }
    }
    setLoading(false);
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

  const AnswerContent = (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Answer</CardTitle>
      </CardHeader>
      <CardContent>
        <CollapsibleContent
          maxHeight={500}
          content={
            <MarkdownRenderer
              content={answer}
              className="rounded-lg bg-white shadow-sm dark:bg-gray-800"
            />
          }
        />
      </CardContent>
    </Card>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <div className="max-h-[85vh] overflow-y-auto px-4 pb-6">
              <DrawerHeader className="pl-0 text-left">
                <DrawerTitle className="text-muted-foreground">
                  {question}
                </DrawerTitle>
              </DrawerHeader>
              {AnswerContent}

              {filesReferences.length > 0 && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Code References</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CodeReferences filesReferences={filesReferences} />
                  </CardContent>
                </Card>
              )}
              <div className="mt-4 flex justify-between">
                <Button
                  variant="outline"
                  onClick={handleSaveAnswer}
                  disabled={saveAnswer.isPending}
                >
                  Save
                </Button>
                <Button type="button" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent className="overflow-y-auto sm:max-w-[80vw]">
            <SheetHeader>
              <SheetTitle className="text-muted-foreground">
                {question}
              </SheetTitle>
            </SheetHeader>
            {AnswerContent}

            {filesReferences.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Code References</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeReferences filesReferences={filesReferences} />
                </CardContent>
              </Card>
            )}
            <div className="mt-4 flex justify-between">
              <Button
                variant="outline"
                onClick={handleSaveAnswer}
                disabled={saveAnswer.isPending}
              >
                Save
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      <Card className="relative col-span-1 sm:col-span-3">
        <CardHeader>
          <CardTitle>Ask a question</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <Textarea
              placeholder="Which file should I edit to change the home page?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <Button type="submit" disabled={loading} className="mt-4">
              <Sparkles />
              <span>Ask InsightSeek</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
