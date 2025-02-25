import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleContent } from "@/components/collapsible-content";
import MarkdownRenderer from "@/components/markdown-renderer";
import CodeReferences from "@/app/(protected)/dashboard/code-references";
import { QuestionHeader } from "./question-header";

interface QuestionViewProps {
  question: string;
  answer: string;
  date: Date;
  filesReferences?: { fileName: string; sourceCode: string }[];
}

export function QuestionView({
  question,
  answer,
  date,
  filesReferences,
}: QuestionViewProps) {
  return (
    <div className="space-y-6">
      <QuestionHeader question={question} date={date} />

      <Card>
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

      {filesReferences && filesReferences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Code References</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeReferences filesReferences={filesReferences} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
