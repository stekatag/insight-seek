interface QuestionHeaderProps {
  question: string;
  date: Date;
}

export function QuestionHeader({ question, date }: QuestionHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex flex-col-reverse justify-between gap-2 sm:flex-row sm:items-center">
        <h3 className="text-lg font-medium">{question}</h3>
        <time className="text-sm text-muted-foreground">
          {date.toLocaleDateString()}
        </time>
      </div>
    </div>
  );
}
