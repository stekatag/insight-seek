"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import useProject from "@/hooks/use-project";
import { api } from "@/trpc/react";
import AskQuestionCard from "../dashboard/ask-question-card";
import { Fragment, useState } from "react";
import Image from "next/image";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { QuestionView } from "@/app/(protected)/qa/question-view";
import {
  NoProjectEmptyState,
  NoQuestionsEmptyState,
} from "@/components/empty-states";

type FileReference = {
  fileName: string;
  sourceCode: string;
};

export default function QAPage() {
  const { project, projectId } = useProject();
  const hasProject = !!project;

  const { data: questions, isLoading } = api.project.getAnswers.useQuery(
    { projectId },
    {
      enabled: hasProject, // Only fetch if there's a project
      staleTime: 0, // Don't use cached data from other sessions/projects
    },
  );

  const isMobile = useIsMobile();

  const [questionIndex, setQuestionIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const question = questions?.[questionIndex];

  const handleQuestionClick = (idx: number) => {
    setQuestionIndex(idx);
    setIsOpen(true);
  };

  // Show empty state when no project exists
  if (!hasProject) {
    return (
      <div className="space-y-6">
        <NoProjectEmptyState type="questions" />
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const QuestionsList = (
    <div className="flex flex-col gap-2">
      {questions?.map((question, idx) => (
        <Fragment key={question.id}>
          <div
            onClick={() => handleQuestionClick(idx)}
            className="flex cursor-pointer items-center gap-4 rounded-lg border bg-white p-4 shadow hover:bg-gray-50"
          >
            <Image
              className="rounded-full"
              alt="User"
              height={30}
              width={30}
              src={question?.user.imageUrl ?? ""}
            />
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <p className="line-clamp-1 text-lg font-medium text-gray-700">
                  {question.question}
                </p>
                <span className="whitespace-nowrap text-xs text-gray-400">
                  {question.createdAt.toLocaleDateString()}
                </span>
              </div>
              <p className="line-clamp-1 text-sm text-gray-500">
                {question.answer}
              </p>
            </div>
          </div>
        </Fragment>
      ))}
    </div>
  );

  const QuestionContent = question && (
    <QuestionView
      question={question.question}
      answer={question.answer}
      date={question.createdAt}
      filesReferences={question.filesReferences as FileReference[]}
    />
  );

  return (
    <>
      <AskQuestionCard />

      <h2 className="mb-2 mt-4 text-xl font-semibold">Saved Questions</h2>

      {questions?.length === 0 ? <NoQuestionsEmptyState /> : QuestionsList}

      {isMobile ? (
        <Drawer open={isOpen && !!question} onOpenChange={setIsOpen}>
          <DrawerContent>
            <div className="max-h-[85vh] overflow-y-auto px-4 pb-6">
              <DrawerHeader className="pl-0 text-left">
                <DrawerTitle className="text-muted-foreground">
                  Saved Question
                </DrawerTitle>
              </DrawerHeader>
              {QuestionContent}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={isOpen && !!question} onOpenChange={setIsOpen}>
          <SheetContent className="overflow-y-auto sm:max-w-[80vw]">
            <SheetHeader>
              <SheetTitle className="text-muted-foreground">
                Saved Question
              </SheetTitle>
            </SheetHeader>
            {QuestionContent}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
