import Link from "next/link";
import { ArrowRight, Folder, Plus, Presentation, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OnboardingView() {
  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome to Insight Seek!
            </h1>
            <p className="mt-1 text-muted-foreground">
              Your dashboard is ready. Get started by creating your first
              project.
            </p>
          </div>
          <Link href="/create">
            <Button className="w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Dashboard main content */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left column - Quick actions */}
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Key actions to begin with Insight Seek
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Folder className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-medium leading-none">
                    Create your first project
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Connect your GitHub repository for insights
                  </p>
                </div>
                <Link href="/create">
                  <Button variant="ghost" size="sm" className="rounded-full">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Presentation className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-medium leading-none">
                    Upload your first meeting
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Get AI-powered insights and summaries from your recordings
                  </p>
                </div>
                <Link href="/create">
                  <Button variant="ghost" size="sm" className="rounded-full">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Did you know?</CardTitle>
              <CardDescription>
                Tips and features to enhance your experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <h3 className="mb-1 font-medium">AI-powered code analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Our system analyzes your codebase to provide contextual
                    insights about your projects.
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <h3 className="mb-1 font-medium">
                    Automated meeting summaries
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Schedule meetings directly from the dashboard and get
                    AI-generated summaries afterward.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Custom Onboarding Meeting Card */}
        <div className="h-full">
          <Card className="col-span-2 h-full border-dashed bg-muted/10 transition-all duration-200">
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Presentation className="h-7 w-7 text-primary" />
              </div>

              <CardTitle className="mb-2 text-lg font-semibold">
                Meeting Analysis
              </CardTitle>

              <CardDescription className="mb-6 max-w-xs">
                Create a project first to unlock AI-powered meeting analysis and
                transcription.
              </CardDescription>

              <Link href="/create">
                <Button size="lg" variant="outline">
                  <Plus className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="text-primary">Create a Project</span>
                </Button>
              </Link>

              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Unlock recording uploads and AI analysis</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
