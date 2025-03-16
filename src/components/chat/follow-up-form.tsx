import { FormEvent, useRef, useState } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface FollowUpFormProps {
  isProcessing: boolean;
  onSubmit: (question: string) => void;
}

export default function FollowUpForm({
  isProcessing,
  onSubmit,
}: FollowUpFormProps) {
  const [question, setQuestion] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isProcessing) return;

    // Pass the question to parent and clear input
    onSubmit(question);
    setQuestion("");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full px-3 pb-2">
      <div className="relative flex items-end">
        <Textarea
          ref={textareaRef}
          placeholder={
            isProcessing
              ? "Processing question..."
              : "Ask a follow-up question..."
          }
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isProcessing}
          className={`min-h-[60px] resize-none pr-12 py-3 rounded-full ${isProcessing ? "opacity-70 bg-muted" : ""}`}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !isProcessing) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          required
          data-state={isProcessing ? "streaming" : "idle"}
        />
        <Button
          type="submit"
          disabled={!question.trim() || isProcessing}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full p-0 text-primary-foreground"
          variant="default"
          data-state={isProcessing ? "streaming" : "idle"}
        >
          {isProcessing ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
}
