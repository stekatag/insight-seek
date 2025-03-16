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
  filesReferences?: FileReference[];
  answerLoading?: boolean; // Optional flag for UI loading state
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

// Helper function to safely parse JSON
export function safeJsonParse<T>(
  jsonValue: JsonValue | null,
  defaultValue: T,
): T {
  if (jsonValue === null || jsonValue === undefined) {
    return defaultValue;
  }

  try {
    return JSON.parse(String(jsonValue)) as T;
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    return defaultValue;
  }
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
  return {
    id: dbQuestion.id,
    question: dbQuestion.question,
    answer: dbQuestion.answer,
    filesReferences: safeJsonParse<FileReference[]>(
      dbQuestion.filesReferences,
      [],
    ),
  };
}

// Convert database questions array to chat-compatible questions
export function adaptDatabaseQuestions(questions: any[]): ChatQuestion[] {
  return questions.map(adaptDatabaseQuestion);
}
