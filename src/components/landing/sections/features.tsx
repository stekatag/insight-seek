import { icons } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface FeatureProps {
  icon: string;
  title: string;
  description: string;
}

const featuresList: FeatureProps[] = [
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

export const FeaturesSection = () => {
  return (
    <section id="features" className="container  py-24 sm:py-32">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
        Our Features
      </h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {featuresList.map(({ icon, title, description }) => {
          const LucideIcon = icons[icon as keyof typeof icons];

          return (
            <Card key={title} className="feature-card">
              <CardContent className="pt-6">
                <div className="mb-4">
                  {LucideIcon ? (
                    <LucideIcon
                      size={28}
                      color="hsl(var(--primary))"
                      className="text-primary"
                    />
                  ) : (
                    <div className="text-primary">Icon not found</div>
                  )}
                </div>
                <h3 className="text-xl font-bold mb-2">{title}</h3>
                <p className="text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
