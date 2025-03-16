import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import { Chat, FileReference } from "@/types/chat";

import {
  ChatAction,
  chatReducer,
  ChatState,
  initialChatState,
} from "./chat-reducer";

type ChatContextType = {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  // Common action helpers
  openDialog: (chat: Chat, isTemp?: boolean) => void;
  closeDialog: () => void;
  updateChat: (chat: Chat) => void;
  setFollowUpQuestion: (question: string) => void;
  addFollowUpOptimistically: (
    question: string,
    answer: string,
    filesReferences?: FileReference[],
  ) => void;
  updateUrl: (chatId: string | null) => void;
};

// Create the context
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Provider component
export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);

  // Use refs to track URL update state to prevent race conditions
  const isUpdatingURL = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stop handling URL updates when unmounting
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Completely fixed URL update function
  const updateUrl = useCallback((chatId?: string | null) => {
    // If already updating, clear the previous timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    // Set updating flag
    isUpdatingURL.current = true;

    // Handle URL update immediately
    try {
      const url = new URL(window.location.href);

      if (!chatId) {
        // Remove chat parameter
        if (url.searchParams.has("chat")) {
          url.searchParams.delete("chat");
          window.history.replaceState({}, "", url.toString());
        }
      } else {
        // Set chat parameter
        url.searchParams.set("chat", chatId);
        window.history.replaceState({}, "", url.toString());
      }
    } catch (error) {
      console.error("URL update error:", error);
    }

    // Clear updating flag after delay to prevent rapid changes
    updateTimeoutRef.current = setTimeout(() => {
      isUpdatingURL.current = false;
      updateTimeoutRef.current = null;
    }, 300);
  }, []);

  // Action helper functions with optimized performance
  const openDialog = useCallback(
    (chat: Chat, isTemp = false) => {
      dispatch({ type: "OPEN_DIALOG", payload: { chat, isTemp } });

      // Update URL only for permanent chats and when not already in a URL update process
      if (!isTemp && chat.id && !isUpdatingURL.current) {
        updateUrl(chat.id);
      }
    },
    [updateUrl],
  );

  const closeDialog = useCallback(() => {
    // Clear URL first if not already updating
    if (!isUpdatingURL.current) {
      updateUrl(null);
    }

    // Then close dialog
    dispatch({ type: "CLOSE_DIALOG" });
  }, [updateUrl]);

  const updateChat = useCallback(
    (chat: Chat) => {
      dispatch({ type: "UPDATE_CHAT", payload: chat });

      // Update URL for permanent chats only
      if (chat.id && chat.id !== "temp" && !isUpdatingURL.current) {
        updateUrl(chat.id);
      }
    },
    [updateUrl],
  );

  // Other actions with useCallback
  const setFollowUpQuestion = useCallback((question: string) => {
    dispatch({ type: "SET_FOLLOW_UP", payload: question });
  }, []);

  const addFollowUpOptimistically = useCallback(
    (
      question: string,
      answer: string,
      filesReferences: FileReference[] = [],
    ) => {
      dispatch({
        type: "ADD_FOLLOW_UP_OPTIMISTICALLY",
        payload: { question, answer, filesReferences },
      });
    },
    [],
  );

  // Memoize the context value
  const value = useMemo(
    () => ({
      state,
      dispatch,
      openDialog,
      closeDialog,
      updateChat,
      setFollowUpQuestion,
      addFollowUpOptimistically,
      updateUrl, // Add this missing export
    }),
    [
      state,
      openDialog,
      closeDialog,
      updateChat,
      setFollowUpQuestion,
      addFollowUpOptimistically,
      updateUrl,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// Hook for using the chat context
export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
};
