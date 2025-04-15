// Define the type for benefit items
export interface BenefitsProps {
  icon: string;
  title: string;
  description: string;
}

// Export the benefits data
export const benefitList: BenefitsProps[] = [
  {
    icon: "CodeXml",
    title: "Understand Complex Codebases",
    description:
      "Quickly get insights into unfamiliar repositories. Our AI analyzes code structure and provides clear explanations of functionality.",
  },
  {
    icon: "GitGraph",
    title: "Commit Summaries",
    description:
      "Stop wasting time reviewing lengthy commit histories. Get AI-generated summaries of changes and their impact on your project.",
  },
  {
    icon: "Mic",
    title: "Meeting Intelligence",
    description:
      "Transform meeting recordings into searchable insights. Extract action items, decisions, and key points without manual note-taking.",
  },
  {
    icon: "MessagesSquare",
    title: "Interactive Q&A",
    description:
      "Ask specific questions about your code or meetings and receive instant, contextually relevant answers from our specialized AI.",
  },
];
