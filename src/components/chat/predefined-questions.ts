import {
  AlertCircle,
  BrainCircuit,
  Code,
  FileSearch,
  GitBranch,
  Info,
  Lightbulb,
  Mic,
  Users,
  type LucideIcon,
} from "lucide-react";

// Define the question interface
export interface PredefinedQuestion {
  text: string;
  icon: LucideIcon;
  color: string;
  category: "code" | "meeting";
}

// Code-related predefined questions
export const codeQuestions: PredefinedQuestion[] = [
  {
    text: "What can I ask about this repo?",
    icon: Info,
    color: "text-blue-500",
    category: "code",
  },
  {
    text: "Give me a brief summary of this project",
    icon: FileSearch,
    color: "text-purple-500",
    category: "code",
  },
  {
    text: "What technologies does this project use?",
    icon: Lightbulb,
    color: "text-amber-500",
    category: "code",
  },
  {
    text: "What design patterns are used in this codebase?",
    icon: Code,
    color: "text-blue-500",
    category: "code",
  },
  {
    text: "What changes were made in the most recent commits?",
    icon: GitBranch,
    color: "text-gray-500",
    category: "code",
  },
];

// Meeting-related predefined questions
export const meetingQuestions: PredefinedQuestion[] = [
  {
    text: "Summarize this meeting",
    icon: Mic,
    color: "text-purple-500",
    category: "meeting",
  },
  {
    text: "What were the key decisions made?",
    icon: AlertCircle,
    color: "text-red-500",
    category: "meeting",
  },
  {
    text: "Who were the main participants and what did they contribute?",
    icon: Users,
    color: "text-green-500",
    category: "meeting",
  },
  {
    text: "What challenges were discussed?",
    icon: BrainCircuit,
    color: "text-amber-500",
    category: "meeting",
  },
];

// Export all questions for backward compatibility
export const predefinedQuestions = [...codeQuestions];

// Get questions based on the context (code or meeting)
export function getQuestionsByType(
  type: "code" | "meeting",
): PredefinedQuestion[] {
  return type === "code" ? codeQuestions : meetingQuestions;
}
