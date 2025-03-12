// Define types for better clarity
export interface FileReference {
  fileName: string;
  sourceCode: string;
  summary: string;
  projectId?: string;
  similarity?: number;
}

export interface ChatQuestion {
  id: string;
  question: string;
  answer: string;
  filesReferences?: FileReference[];
}

export interface Chat {
  id: string;
  title: string;
  questions: ChatQuestion[];
}

// Define possible chat states for better state management
export type ChatState = {
  // Chat management
  status: "idle" | "loading" | "streaming" | "saving" | "complete" | "error";
  tempChat: Chat | null;
  savedChat: Chat | null;

  // Input management
  question: string;
  answer: string;
  followUpQuestion: string;

  // References and content
  filesReferences: FileReference[];
  streamContent: string;

  // UI state
  error: string | null;
  isDialogOpen: boolean;
  isStreaming: boolean; // <-- Critical for controlling input state
};

export type ChatAction =
  // Input management
  | { type: "SET_QUESTION"; payload: string }
  | { type: "SET_FOLLOW_UP"; payload: string }

  // Dialog state
  | { type: "SET_DIALOG_OPEN"; payload: boolean }
  | { type: "RESET" }

  // Initial QA flow
  | { type: "START_LOADING" }
  | {
      type: "STREAM_ANSWER";
      payload: { content: string; filesReferences: FileReference[] };
    }
  | { type: "COMPLETE_ANSWER"; payload: string }
  | { type: "SET_SAVED_CHAT"; payload: Chat }
  | { type: "SET_ERROR"; payload: string }

  // Follow-up QA flow
  | { type: "START_FOLLOW_UP_STREAMING" }
  | { type: "SET_STREAM_CONTENT"; payload: string }
  | {
      type: "ADD_FOLLOW_UP_ANSWER";
      payload: {
        question: string;
        answer: string;
        filesReferences: FileReference[];
      };
    }
  | { type: "STOP_STREAMING" };

// Initial state for chat
export const initialChatState: ChatState = {
  status: "idle",
  tempChat: null,
  savedChat: null,
  question: "",
  answer: "",
  followUpQuestion: "",
  filesReferences: [],
  streamContent: "",
  error: null,
  isDialogOpen: false,
  isStreaming: false,
};

// Reducer function to manage all chat-related state
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_QUESTION":
      return { ...state, question: action.payload };

    case "START_LOADING": {
      const tempChat: Chat = {
        id: `temp-${Date.now()}`,
        title: state.question,
        questions: [
          {
            id: `temp-q-${Date.now()}`,
            question: state.question,
            answer: "Getting answer...",
            filesReferences: [],
          },
        ],
      };

      return {
        ...state,
        status: "loading",
        tempChat,
        isDialogOpen: true,
        savedChat: null,
        answer: "",
        filesReferences: [],
        streamContent: "",
        isStreaming: true,
      };
    }

    case "STREAM_ANSWER": {
      // Don't use streamContent field directly here to avoid duplication
      // Instead, update the temporary chat's answer directly
      if (!state.tempChat) return state;

      const updatedTempChat = {
        ...state.tempChat,
        questions: [
          {
            ...state.tempChat.questions[0],
            answer: action.payload.content,
            filesReferences: action.payload.filesReferences,
          },
        ],
      };

      return {
        ...state,
        status: "streaming",
        // @ts-expect-error: tempChat is updated above
        tempChat: updatedTempChat,
        answer: action.payload.content,
        filesReferences: action.payload.filesReferences,
        isStreaming: true,
      };
    }

    case "COMPLETE_ANSWER":
      return {
        ...state,
        status: "complete",
        answer: action.payload,
        isStreaming: false,
      };

    case "SET_SAVED_CHAT":
      return {
        ...state,
        status: "complete",
        savedChat: action.payload,
        tempChat: null, // Clear temp chat once we have a saved one
        isStreaming: false,
      };

    case "SET_ERROR":
      return {
        ...state,
        status: "error",
        error: action.payload,
        isDialogOpen: false,
        tempChat: null,
        isStreaming: false,
      };

    case "SET_FOLLOW_UP":
      return {
        ...state,
        followUpQuestion: action.payload,
      };

    // Special actions for follow-up questions
    case "START_FOLLOW_UP_STREAMING":
      return {
        ...state,
        streamContent: "",
        isStreaming: true,
      };

    // Handle streaming content separately for follow-ups
    case "SET_STREAM_CONTENT":
      return {
        ...state,
        streamContent: action.payload,
        isStreaming: true,
      };

    case "STOP_STREAMING":
      return {
        ...state,
        isStreaming: false,
        streamContent: "",
      };

    case "ADD_FOLLOW_UP_ANSWER": {
      // Handle follow-up answer for either temp or saved chat
      const activeChat = state.savedChat || state.tempChat;
      if (!activeChat) return state;

      const newQuestion: ChatQuestion = {
        id: `followup-${Date.now()}`,
        question: action.payload.question,
        answer: action.payload.answer,
        filesReferences: action.payload.filesReferences,
      };

      if (state.savedChat) {
        const updatedSavedChat = {
          ...state.savedChat,
          questions: [...state.savedChat.questions, newQuestion],
        };

        return {
          ...state,
          savedChat: updatedSavedChat,
          followUpQuestion: "",
          streamContent: "",
          isStreaming: false,
        };
      } else if (state.tempChat) {
        const updatedTempChat = {
          ...state.tempChat,
          questions: [...state.tempChat.questions, newQuestion],
        };

        return {
          ...state,
          tempChat: updatedTempChat,
          followUpQuestion: "",
          streamContent: "",
          isStreaming: false,
        };
      }

      return state;
    }

    case "SET_DIALOG_OPEN":
      return {
        ...state,
        isDialogOpen: action.payload,
        // Clear these states when dialog closes
        ...(action.payload === false && {
          streamContent: "",
          followUpQuestion: "",
          isStreaming: false,
        }),
      };

    case "RESET":
      return initialChatState;

    default:
      return state;
  }
}
