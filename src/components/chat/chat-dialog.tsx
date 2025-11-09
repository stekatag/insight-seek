import { memo, useEffect, useRef, useState } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import ChatContent from "./chat-content";
import { useChatContext } from "./chat-context";
import FollowUpForm from "./follow-up-form";

interface ChatDialogProps {
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onFollowUpSubmit: (question: string) => Promise<void>;
}

function ChatDialog({ messagesEndRef, onFollowUpSubmit }: ChatDialogProps) {
  const isMobile = useIsMobile();
  const { state, closeDialog } = useChatContext();
  const { isDialogOpen, activeChat, isTempChat } = state;

  // Add ref to prevent double-close issues
  const isClosingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Local state for follow-up processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamState, setStreamState] = useState({
    processing: false,
    question: "",
  });

  // Reset processing state when chat or dialog state changes
  useEffect(() => {
    setIsProcessing(false);
    setStreamState({
      processing: false,
      question: "",
    });
  }, [activeChat?.id, isDialogOpen]);

  // Clear any timeouts when unmounting
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Optimized follow-up submission
  const handleFollowUpSubmit = async (question: string) => {
    if (!question.trim() || isProcessing) return;

    try {
      // Update processing state
      setIsProcessing(true);
      setStreamState({
        processing: true,
        question,
      });

      // Call parent handler
      await onFollowUpSubmit(question);

      // Reset processing state if still mounted
      if (isDialogOpen) {
        setIsProcessing(false);
        setStreamState({
          processing: false,
          question: "",
        });
      }
    } catch (error) {
      console.error("Follow-up error:", error);
      if (isDialogOpen) {
        setIsProcessing(false);
        setStreamState({
          processing: false,
          question: "",
        });
      }
    }
  };

  // Safer dialog close handling to prevent race conditions
  const handleDialogChange = (open: boolean) => {
    if (!open && !isClosingRef.current) {
      // Prevent multiple close attempts
      isClosingRef.current = true;
      closeDialog();

      // Reset closing state after delay to allow for URL updates
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        isClosingRef.current = false;
      }, 500);
    }
  };

  // Don't render if dialog not open
  if (!isDialogOpen || !activeChat) return null;

  // Dialog title - cached
  const dialogTitle = activeChat?.title || "AI Response";

  if (isMobile) {
    return (
      <Drawer open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DrawerContent>
          <div className="flex h-[85vh] flex-col overflow-hidden">
            <DrawerHeader className="flex-none border-b pl-4 text-left">
              <DrawerTitle className="text-muted-foreground line-clamp-1">
                {dialogTitle}
                {isTempChat && " (Preview)"}
              </DrawerTitle>
            </DrawerHeader>
            <div className="grow overflow-hidden">
              <ChatContent
                chat={activeChat}
                messagesEndRef={messagesEndRef}
                streamQuestion={streamState.question}
                streamProcessing={streamState.processing}
              />
            </div>
            <DrawerFooter className="border-t pt-2 px-0">
              <FollowUpForm
                isProcessing={isProcessing}
                onSubmit={handleFollowUpSubmit}
              />
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={isDialogOpen} onOpenChange={handleDialogChange}>
      <SheetContent className="flex flex-col h-full w-full p-0 overflow-hidden sm:max-w-[80vw] gap-0 rounded-tl-lg rounded-bl-lg">
        <SheetHeader className="flex-none border-b p-4">
          <SheetTitle className="text-muted-foreground line-clamp-2">
            {dialogTitle}
            {isTempChat && " (Preview)"}
          </SheetTitle>
        </SheetHeader>
        <div className="grow overflow-hidden">
          <ChatContent
            chat={activeChat}
            messagesEndRef={messagesEndRef}
            streamQuestion={streamState.question}
            streamProcessing={streamState.processing}
          />
        </div>
        <SheetFooter className="border-t bg-background p-4">
          <FollowUpForm
            isProcessing={isProcessing}
            onSubmit={handleFollowUpSubmit}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Export a memoized version
export default memo(ChatDialog);
