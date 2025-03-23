// Define centralized types for chat functionality across the application

import { JsonValue } from "@prisma/client/runtime/library";

// File reference type for code references
export type FileReference = {
  fileName: string;
  sourceCode: string;
  summary: string;
  projectId?: string;
  similarity?: number;
};

// Base question interface without metadata
export type ChatQuestion = {
  id: string;
  question: string;
  answer: string;
  filesReferences: FileReference[];
  answerLoading?: boolean;
  referencesLoading?: boolean;
};

// Database question interface with full metadata - matches Prisma schema
export type DatabaseQuestion = {
  id: string;
  question: string;
  answer: string;
  filesReferences: JsonValue | null;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  chatId: string | null;
  isFollowUp: boolean;
  meetingId?: string | null;
};

// Base chat interface for UI usage
export type Chat = {
  id: string;
  title: string;
  questions: ChatQuestion[];
  updatedAt?: Date;
  createdAt?: Date;
  projectId?: string | null;
  meetingId?: string | null;
  isLoading?: boolean;
};

// Database chat interface - matches Prisma schema
export type DatabaseChat = {
  id: string;
  title: string;
  projectId: string | null;
  meetingId: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
};

// Add optimized adapter function to avoid deep processing during chat loading
export function adaptChatForDisplay(chat: any): Chat {
  // Quick safety check
  if (!chat)
    return {
      id: `invalid-${Date.now()}`,
      title: "Invalid Chat",
      questions: [],
    };

  // Fast minimal transformation for initial display
  // Avoid deep processing of questions initially - lazy load them
  return {
    id: chat.id,
    title: chat.title || "Untitled Chat",
    questions:
      chat.questions?.map((q: any) => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        // Just check existence, don't process references yet
        filesReferences: Array.isArray(q.filesReferences)
          ? q.filesReferences
          : [],
      })) || [],
    updatedAt: chat.updatedAt,
    createdAt: chat.createdAt,
    projectId: chat.projectId,
    meetingId: chat.meetingId,
  };
}

// Make the JSON parsing function even more efficient
export function safeJsonParse<T>(
  jsonValue: JsonValue | null,
  defaultValue: T,
): T {
  // Fast path for null/undefined
  if (jsonValue == null) return defaultValue;

  // Fast path for arrays
  if (Array.isArray(jsonValue)) return jsonValue as unknown as T;

  // Fast path for objects
  if (typeof jsonValue === "object" && jsonValue !== null) {
    return jsonValue as unknown as T;
  }

  // Handle string values
  if (typeof jsonValue === "string") {
    // Skip empty strings quickly
    if (!jsonValue) return defaultValue;

    try {
      return JSON.parse(jsonValue) as T;
    } catch {
      // Don't log error for better performance
      return defaultValue;
    }
  }

  return defaultValue;
}

// Utility to convert database questions to chat questions
export const questionFromDatabase = (
  dbQuestion: DatabaseQuestion,
): ChatQuestion => {
  return {
    id: dbQuestion.id,
    question: dbQuestion.question,
    answer: dbQuestion.answer,
    filesReferences: safeJsonParse<FileReference[]>(
      dbQuestion.filesReferences,
      [],
    ),
  };
};

// Utility to convert database chat to UI chat
export const chatFromDatabase = (
  dbChat: DatabaseChat,
  dbQuestions: DatabaseQuestion[],
): Chat => {
  return {
    id: dbChat.id,
    title: dbChat.title,
    questions: dbQuestions.map(questionFromDatabase),
    updatedAt: dbChat.updatedAt,
    createdAt: dbChat.createdAt,
    projectId: dbChat.projectId,
    meetingId: dbChat.meetingId,
  };
};

// Convert a database question to a chat-compatible question
export function adaptDatabaseQuestion(dbQuestion: any): ChatQuestion {
  // Add a safety check to ensure dbQuestion is valid
  if (!dbQuestion) {
    return {
      id: `invalid-${Date.now()}`,
      question: "",
      answer: "",
      filesReferences: [],
    };
  }

  let filesReferences = [];

  // Properly parse file references with robust error handling
  try {
    if (dbQuestion.filesReferences) {
      if (Array.isArray(dbQuestion.filesReferences)) {
        // Already an array - make sure each item has sourceCode
        filesReferences = dbQuestion.filesReferences.map(
          (ref: FileReference) => ({
            ...ref,
            // Ensure sourceCode is a string
            sourceCode: ref.sourceCode || "",
          }),
        );
      } else if (typeof dbQuestion.filesReferences === "string") {
        // Try to parse the JSON string
        try {
          const parsed = JSON.parse(dbQuestion.filesReferences);
          if (Array.isArray(parsed)) {
            filesReferences = parsed.map((ref) => ({
              ...ref,
              sourceCode: ref.sourceCode || "",
            }));
          }
        } catch (e) {
          console.error("Failed to parse file references JSON:", e);
        }
      }
    }
  } catch (error) {
    console.error("Error processing file references:", error);
  }

  return {
    id: dbQuestion.id,
    question: dbQuestion.question,
    answer: dbQuestion.answer,
    filesReferences,
    referencesLoading: false, // Explicitly set to false
  };
}

// Convert database questions array to chat-compatible questions
export function adaptDatabaseQuestions(questions: any[]): ChatQuestion[] {
  return questions.map(adaptDatabaseQuestion);
}
