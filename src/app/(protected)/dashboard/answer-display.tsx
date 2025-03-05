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
import { Save, X } from "lucide-react";
import CodeReferences from "@/app/(protected)/dashboard/code-references";
import MarkdownRenderer from "@/components/markdown-renderer";
import { CollapsibleContent } from "@/components/collapsible-content";
import { useIsMobile } from "@/hooks/use-mobile";

interface FilesReference {
  fileName: string;
  sourceCode: string;
  summary: string;
}

export interface AnswerDisplayProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  question: string;
  answer: string;
  filesReferences: FilesReference[];
  onSave: () => void;
  isSaving: boolean;
}

export default function AnswerDisplay({
  open,
  setOpen,
  question,
  answer,
  filesReferences,
  onSave,
  isSaving,
}: AnswerDisplayProps) {
  const isMobile = useIsMobile();

  const AnswerContent = (
    <>
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
    </>
  );

  // Sticky action buttons div
  const ActionButtons = (
    <div className="sticky bottom-0 z-10 my-4 flex justify-between gap-2 rounded-lg border bg-background p-4">
      <Button onClick={onSave} disabled={isSaving}>
        <Save className="mr-2 h-4 w-4" />
        <span>{isSaving ? "Saving..." : "Save answer"}</span>
      </Button>
      <Button variant="outline" type="button" onClick={() => setOpen(false)}>
        <X className="mr-2 h-4 w-4" />
        <span>Close</span>
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="flex max-h-[85vh] flex-col">
            <div className="flex-grow overflow-y-auto px-4">
              <DrawerHeader className="pl-0 text-left">
                <DrawerTitle className="text-muted-foreground">
                  {question}
                </DrawerTitle>
              </DrawerHeader>
              {AnswerContent}
              {ActionButtons}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex flex-col p-6 sm:max-w-[80vw]">
        <div className="flex-grow overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-muted-foreground">
              {question}
            </SheetTitle>
          </SheetHeader>
          {AnswerContent}
          {ActionButtons}
        </div>
      </SheetContent>
    </Sheet>
  );
}
