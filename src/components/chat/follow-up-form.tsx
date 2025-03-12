import { FormEvent, useCallback, useEffect, useRef } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FollowUpFormProps {
  followUpQuestion: string;
  isStreaming: boolean;
  onFollowUpChange: (value: string) => void;
  onFollowUpSubmit: (e: FormEvent) => Promise<void>;
}

export default function FollowUpForm({
  followUpQuestion,
  isStreaming,
  onFollowUpChange,
  onFollowUpSubmit,
}: FollowUpFormProps) {
  // Keep refs for DOM access
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreamingRef = useRef(isStreaming);

  // Keep the ref in sync with the prop
  useEffect(() => {
    isStreamingRef.current = isStreaming;

    // Force the disabled state - extra safety for edge cases
    if (textareaRef.current) {
      if (isStreaming) {
        textareaRef.current.setAttribute("disabled", "true");
      } else {
        textareaRef.current.removeAttribute("disabled");
      }
    }
  }, [isStreaming]);

  // Log streaming state for debugging
  useEffect(() => {
    console.log("FollowUpForm isStreaming:", isStreaming);
  }, [isStreaming]);

  // Optimize the on change handler using useCallback
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Don't process changes during streaming
      if (isStreamingRef.current) return;

      // Use event.target.value directly to prevent unnecessary re-renders
      onFollowUpChange(e.target.value);
    },
    [onFollowUpChange],
  );

  // Optimize key down handler with useCallback
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Don't process if streaming is happening
      if (isStreamingRef.current) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (followUpQuestion.trim()) {
          onFollowUpSubmit(e as unknown as FormEvent);
        }
      }
    },
    [followUpQuestion, onFollowUpSubmit],
  );

  // Handle form submission with more checks
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Extra check to prevent submission during streaming
      if (isStreamingRef.current || !followUpQuestion.trim()) {
        return;
      }

      onFollowUpSubmit(e as FormEvent);
    },
    [followUpQuestion, onFollowUpSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full px-3 pb-2">
      <div className="relative flex items-end">
        <Textarea
          ref={textareaRef}
          placeholder={
            isStreaming
              ? "Processing question..."
              : "Ask a follow-up question..."
          }
          value={followUpQuestion}
          disabled={isStreaming}
          onChange={handleInputChange}
          className={`min-h-[60px] resize-none pr-12 py-3 rounded-full ${
            isStreaming ? "opacity-70 bg-muted" : ""
          }`}
          rows={1}
          onKeyDown={handleKeyDown}
          required
          data-state={isStreaming ? "streaming" : "idle"}
        />
        <Button
          type="submit"
          disabled={!followUpQuestion.trim() || isStreaming}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full p-0 text-primary-foreground"
          variant="default"
          data-state={isStreaming ? "streaming" : "idle"}
        >
          {isStreaming ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
}
