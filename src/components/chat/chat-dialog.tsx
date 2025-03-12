import { RefObject } from "react";

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
import FollowUpForm from "./follow-up-form";

interface ChatDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeChat: any; // Replace with proper type
  title?: string;
  followUpQuestion: string;
  isStreaming: boolean;
  streamContent: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onFollowUpChange: (value: string) => void;
  onFollowUpSubmit: (e: any) => Promise<void>;
}

export default function ChatDialog({
  isOpen,
  setIsOpen,
  activeChat,
  title,
  followUpQuestion,
  isStreaming,
  streamContent,
  messagesEndRef,
  onFollowUpChange,
  onFollowUpSubmit,
}: ChatDialogProps) {
  const isMobile = useIsMobile();

  if (!activeChat) return null;

  // Use custom title if provided, otherwise use the chat's title or a default
  const dialogTitle = title || activeChat.title || "AI Response";

  // Make sure to include isStreaming in the props
  const followUpFormProps = {
    followUpQuestion,
    isStreaming,
    onFollowUpChange,
    onFollowUpSubmit,
  };

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent>
          <div className="flex h-[85vh] flex-col overflow-hidden">
            <DrawerHeader className="flex-none border-b pl-4 text-left">
              <DrawerTitle className="text-muted-foreground line-clamp-1">
                {dialogTitle}
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex-grow overflow-hidden">
              <ChatContent
                chat={activeChat}
                streamContent={streamContent}
                messagesEndRef={messagesEndRef}
              />
            </div>
            <DrawerFooter className="border-t pt-2 px-0">
              <FollowUpForm {...followUpFormProps} />
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex flex-col h-full w-full p-0 overflow-hidden sm:max-w-[80vw] gap-0 rounded-tl-lg rounded-bl-lg">
        <SheetHeader className="flex-none border-b p-4">
          <SheetTitle className="text-muted-foreground line-clamp-2">
            {dialogTitle}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-grow overflow-hidden">
          <ChatContent
            chat={activeChat}
            streamContent={streamContent}
            messagesEndRef={messagesEndRef}
          />
        </div>
        <SheetFooter className="border-t bg-background p-4">
          <FollowUpForm {...followUpFormProps} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
