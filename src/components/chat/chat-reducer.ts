// Import shared types
import { Chat, FileReference } from "@/types/chat";

// Define possible chat states for better state management
export type ChatState = {
  // Chat management
  status: "idle" | "loading" | "streaming" | "saving" | "complete" | "error";
  tempChat: Chat | null;
  savedChat: Chat | null;
  activeChat: Chat | null;

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
  isStreaming: boolean;
  isTempChat: boolean;
  urlUpdating: boolean;
};

export type ChatAction =
  // Input management
  | { type: "SET_QUESTION"; payload: string }
  | { type: "SET_FOLLOW_UP"; payload: string }

  // Dialog state
  | { type: "OPEN_DIALOG"; payload: { chat: Chat; isTemp?: boolean } }
  | { type: "CLOSE_DIALOG" }
  | { type: "UPDATE_CHAT"; payload: Chat }
  | { type: "RESET" }
  | { type: "SET_URL_UPDATING"; payload: boolean }

  // Initial QA flow
  | { type: "START_LOADING" }
  | {
      type: "STREAM_ANSWER";
      payload: { content: string; filesReferences: FileReference[] };
    }
  | {
      type: "COMPLETE_ANSWER";
      payload: {
        answer: string;
        filesReferences: FileReference[];
      };
    }
  | { type: "SET_SAVED_CHAT"; payload: Chat }
  | { type: "SET_ERROR"; payload: string }

  // Follow-up QA flow
  | { type: "START_FOLLOW_UP_STREAMING" }
  | { type: "SET_STREAM_CONTENT"; payload: string }
  | { type: "STOP_STREAMING" }
  | {
      type: "ADD_FOLLOW_UP_OPTIMISTICALLY";
      payload: {
        question: string;
        answer: string;
        filesReferences: FileReference[];
      };
    };

// Initial state for chat
export const initialChatState: ChatState = {
  status: "idle",
  tempChat: null,
  savedChat: null,
  activeChat: null,
  question: "",
  answer: "",
  followUpQuestion: "",
  filesReferences: [],
  streamContent: "",
  error: null,
  isDialogOpen: false,
  isStreaming: false,
  isTempChat: false,
  urlUpdating: false,
};

// Optimized reducer with improved state updates
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_QUESTION":
      return { ...state, question: action.payload };

    case "SET_FOLLOW_UP":
      return { ...state, followUpQuestion: action.payload };

    case "OPEN_DIALOG": {
      const { chat, isTemp = false } = action.payload;
      // Fast path: if already open with same chat, don't update
      if (state.isDialogOpen && state.activeChat?.id === chat.id) {
        return state;
      }

      return {
        ...state,
        isDialogOpen: true,
        activeChat: chat,
        isTempChat: isTemp,
        followUpQuestion: "",
        streamContent: "",
        isStreaming: false,
      };
    }

    case "CLOSE_DIALOG": {
      // Fast path: if already closed, don't update
      if (!state.isDialogOpen) return state;

      return {
        ...state,
        isDialogOpen: false,
        activeChat: null,
        isTempChat: false,
        followUpQuestion: "",
        streamContent: "",
        isStreaming: false,
      };
    }

    case "UPDATE_CHAT": {
      // Fast path: if chat is the same, don't update
      if (
        state.activeChat?.id === action.payload.id &&
        JSON.stringify(state.activeChat) === JSON.stringify(action.payload)
      ) {
        return state;
      }

      return {
        ...state,
        activeChat: action.payload,
        isTempChat: false,
      };
    }

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
        activeChat: tempChat,
        isTempChat: true,
        savedChat: null,
        answer: "",
        filesReferences: [],
        streamContent: "",
        isStreaming: true,
      };
    }

    case "STREAM_ANSWER": {
      if (!state.activeChat) return state;

      const updatedChat = {
        ...state.activeChat,
        questions: state.activeChat.questions.map((q, idx) => {
          // Update only the first question for initial streaming
          if (idx === 0 && state.isTempChat) {
            return {
              ...q,
              answer: action.payload.content,
              filesReferences: action.payload.filesReferences,
            };
          }
          return q;
        }),
      };

      return {
        ...state,
        status: "streaming",
        activeChat: updatedChat,
        tempChat: state.isTempChat ? updatedChat : state.tempChat,
        answer: action.payload.content,
        filesReferences: action.payload.filesReferences,
        isStreaming: true,
      };
    }

    case "COMPLETE_ANSWER":
      return {
        ...state,
        status: "complete",
        answer: action.payload.answer,
        filesReferences: action.payload.filesReferences,
        isStreaming: false,
      };

    case "SET_SAVED_CHAT":
      return {
        ...state,
        status: "complete",
        savedChat: action.payload,
        activeChat: action.payload,
        tempChat: null, // Clear temp chat once we have a saved one
        isTempChat: false,
        isStreaming: false,
      };

    case "SET_ERROR":
      return {
        ...state,
        status: "error",
        error: action.payload,
        isDialogOpen: false,
        tempChat: null,
        activeChat: null,
        isStreaming: false,
      };

    case "START_FOLLOW_UP_STREAMING":
      return {
        ...state,
        streamContent: "",
        isStreaming: true,
      };

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

    case "ADD_FOLLOW_UP_OPTIMISTICALLY": {
      // Avoid redundant state updates
      if (!state.activeChat) return state;

      const { question, answer, filesReferences } = action.payload;

      // Skip if the question is already being answered with the same content
      const existingQuestion = state.activeChat.questions.find(
        (q) => q.question === question && q.answer === answer,
      );

      if (existingQuestion) return state;

      // Create new question object
      const newQuestion = {
        id: `followup-${Date.now()}`,
        question,
        answer,
        filesReferences,
      };

      // Find if question already exists in chat
      const existingIndex = state.activeChat.questions.findIndex(
        (q) => q.question === question && q.answer === "Getting answer...",
      );

      let updatedQuestions;

      if (existingIndex >= 0) {
        // Update existing question
        updatedQuestions = [...state.activeChat.questions];
        updatedQuestions[existingIndex] = newQuestion;
      } else {
        // Add new question
        updatedQuestions = [...state.activeChat.questions, newQuestion];
      }

      // Create updated chat
      const updatedChat = {
        ...state.activeChat,
        questions: updatedQuestions,
      };

      // If answer is still loading, keep streaming true
      const isAnswerTemp = answer === "Getting answer...";

      return {
        ...state,
        activeChat: updatedChat,
        // Update the right chat depending on temp status
        ...(state.isTempChat
          ? { tempChat: updatedChat }
          : { savedChat: updatedChat }),
        isStreaming: isAnswerTemp,
        ...(isAnswerTemp ? {} : { followUpQuestion: "", streamContent: "" }),
      };
    }

    case "SET_URL_UPDATING":
      return {
        ...state,
        urlUpdating: action.payload,
      };

    case "RESET":
      return initialChatState;

    default:
      return state;
  }
}
