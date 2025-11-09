import Link from "next/link";
import { ArrowRight, FileText, Folder, Plus, Presentation } from "lucide-react";

import useProject from "@/hooks/use-project";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import MeetingCard from "@/components/meeting-card";
import { ProjectSelector } from "@/components/project-selector";

// Define action items data
const createActionItems = (hasProjects: boolean) => [
  {
    title: hasProjects ? "Create a new project" : "Create your first project",
    description: "Connect your GitHub repository for insights",
    icon: Folder,
    href: "/create",
  },
  {
    title: "Upload a meeting recording",
    description: "Get AI-powered insights and summaries",
    icon: Presentation,
    href: "/meetings",
  },
  {
    title: "Ask questions about your code",
    description: "Get AI explanations about your codebase",
    icon: FileText,
    href: "/qa",
  },
];

export default function OnboardingView() {
  const { projects, isLoading } = useProject();
  // Ensure hasProjects is always boolean using Boolean() constructor
  const hasProjects: boolean = Boolean(
    !isLoading && projects && projects.length > 0,
  );

  // Generate actions based on project status
  const actionItems = createActionItems(hasProjects);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {hasProjects
                ? "Welcome back to Insight Seek!"
                : "Welcome to Insight Seek!"}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {hasProjects
                ? "Continue with an existing project or create a new one."
                : "Your dashboard is ready. Get started by creating your first project."}
            </p>
          </div>
          <Link href="/create">
            <Button className="w-full lg:w-auto">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Dashboard main content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column - Project selection and quick actions */}
        <div className="space-y-6 lg:col-span-2">
          {hasProjects && <ProjectSelector />}

          <Card className="dark:border-secondary">
            <CardHeader>
              <CardTitle>
                {hasProjects ? "Quick Actions" : "Get Started"}
              </CardTitle>
              <CardDescription>
                {hasProjects
                  ? "Common tasks and actions"
                  : "Key actions to begin with Insight Seek"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 px-4 sm:px-6">
              {actionItems.map((item, index) => (
                <div
                  key={index}
                  className="flex sm:items-center flex-col sm:flex-row gap-4 rounded-lg border dark:border-secondary p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="font-medium leading-none">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <Link href={item.href}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full bg-secondary"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Custom Onboarding Meeting Card */}
        <div className="h-full">
          <MeetingCard />
        </div>
      </div>
    </div>
  );
}
