import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface UseChatUrlProps {
  isOpen: boolean;
  chatId?: string | null;
  onUrlChatIdChange?: (chatId: string | null) => void;
}

/**
 * A hook to manage chat URL state
 * Updates the URL with chat ID when a chat is open
 * Removes chat ID from URL when chat is closed
 */
export function useChatUrl({
  isOpen,
  chatId,
  onUrlChatIdChange,
}: UseChatUrlProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Effect to update URL when dialog state changes
  useEffect(() => {
    if (!isOpen || !chatId) {
      // When dialog is closed, remove chat from URL
      const url = new URL(window.location.href);
      if (url.searchParams.has("chat")) {
        url.searchParams.delete("chat");
        router.replace(url.pathname + url.search, { scroll: false });
      }
      return;
    }

    // Update URL with chatId when dialog is open
    const url = new URL(window.location.href);
    if (url.searchParams.get("chat") !== chatId) {
      url.searchParams.set("chat", chatId);
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [isOpen, chatId, router]);

  // Effect to read from URL on mount and when URL changes
  useEffect(() => {
    if (!onUrlChatIdChange) return;

    const urlChatId = searchParams.get("chat");
    onUrlChatIdChange(urlChatId);
  }, [searchParams, onUrlChatIdChange]);
}
