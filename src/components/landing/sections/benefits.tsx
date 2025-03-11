import { icons } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BenefitsProps {
  icon: string;
  title: string;
  description: string;
}

const benefitList: BenefitsProps[] = [
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

export const BenefitsSection = () => {
  return (
    <section id="benefits" className="container py-24 sm:py-32">
      <div className="grid lg:grid-cols-2 place-items-center lg:gap-24">
        <div>
          <h2 className="text-lg text-primary mb-2 tracking-wider">Benefits</h2>

          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Supercharge Your Development Process
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            InsightSeek helps teams save time, improve collaboration, and make
            better decisions by providing AI-powered analysis of both code and
            meetings in one unified platform.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 w-full">
          {benefitList.map(({ icon, title, description }, index) => {
            const LucideIcon = icons[icon as keyof typeof icons];

            return (
              <Card
                key={title}
                className="border-secondary hover:bg-background transition-all delay-75 group/number"
              >
                <CardHeader>
                  <div className="flex justify-between">
                    {LucideIcon ? (
                      <LucideIcon
                        size={32}
                        color="hsl(var(--primary))"
                        className="mb-6 text-primary"
                      />
                    ) : (
                      <div className="mb-6 text-primary">Icon not found</div>
                    )}
                    <span className="text-5xl text-muted-foreground/15 font-medium transition-all delay-75 group-hover/number:text-muted-foreground/30">
                      0{index + 1}
                    </span>
                  </div>

                  <CardTitle>{title}</CardTitle>
                </CardHeader>

                <CardContent className="text-muted-foreground">
                  {description}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
