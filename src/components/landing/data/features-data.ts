// Define the type for a feature
export interface FeatureProps {
  icon: string;
  title: string;
  description: string;
}

// Export the features list data
export const featuresList: FeatureProps[] = [
  {
    icon: "GitBranch",
    title: "Repository Analysis",
    description:
      "Quickly understand complex codebases with AI-powered analysis of your GitHub repositories, both public and private.",
  },
  {
    icon: "Bot",
    title: "Code Q&A Assistant",
    description:
      "Ask specific questions about your codebase and get detailed, contextual answers based on your actual repository structure.",
  },
  {
    icon: "GitGraph",
    title: "Commit Summaries",
    description:
      "Get AI-generated summaries of your commit history to understand changes without diving into code diffs.",
  },
  {
    icon: "Mic",
    title: "Meeting Analysis",
    description:
      "Upload audio recordings of your meetings and get AI-generated transcripts, chapters, and actionable insights.",
  },
  {
    icon: "MessageSquare",
    title: "Meeting Q&A",
    description:
      "Ask follow-up questions about specific meeting segments or get clarification on discussion topics without re-listening.",
  },
  {
    icon: "Save",
    title: "Saved Insights",
    description:
      "Save important answers and insights about your code or meetings for future reference and team knowledge sharing.",
  },
];
