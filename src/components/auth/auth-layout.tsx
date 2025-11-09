"use client";

import Link from "next/link";
import { dark } from "@clerk/themes";
import { BrainCircuit, Code, MessageSquare, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";

import ApplicationLogo from "../application-logo";

type AuthLayoutProps = {
  mode: "sign-in" | "sign-up";
  renderClerkComponent: (baseTheme: any) => React.ReactNode;
};

export default function AuthLayout({
  mode,
  renderClerkComponent,
}: AuthLayoutProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const baseTheme = isDark ? dark : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Decorative elements - hidden on mobile */}
      <div className="fixed inset-0 -z-10 overflow-hidden hidden lg:block">
        {/* Top right gradient blob */}
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl" />

        {/* Bottom left gradient blob */}
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-3xl" />

        {/* Central subtle pattern - optional grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(hsl(var(--primary)/40%) 1px, transparent 1px)`,
            backgroundSize: "30px 30px",
          }}
        />
      </div>

      {/* Simple mobile background - a subtle gradient */}
      <div className="fixed inset-0 -z-10 bg-linear-to-b from-background to-background/95 lg:hidden" />

      {/* Header with logo */}
      <header className="container flex justify-center sm:justify-start pt-6 px-4">
        <Link href="/" className="font-bold text-lg flex items-center gap-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <ApplicationLogo className="p-1.5" />
          </div>
          <span>InsightSeek</span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 container flex flex-col-reverse lg:flex-row items-center justify-center py-6 px-4">
        {/* Left side - Value proposition */}
        <div className="w-full lg:w-1/2 lg:pr-8 xl:pr-16 mt-8 lg:mt-0">
          <div className="text-center lg:text-left mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold">
              {mode === "sign-in" ? "Welcome back" : "Join the community"}
            </h1>
            <p className="text-muted-foreground dark:text-gray-400 text-lg mt-2 max-w-md mx-auto lg:mx-0">
              {mode === "sign-in"
                ? "Sign in to continue exploring AI-powered code and meeting insights"
                : "Start your journey to better code understanding and team collaboration"}
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeatureCard
              icon={<Code />}
              title="Code Understanding"
              description="AI that understands your codebase context"
            />
            <FeatureCard
              icon={<MessageSquare />}
              title="Smart Chat"
              description="Get answers about your code instantly"
            />
            <FeatureCard
              icon={<BrainCircuit />}
              title="Repository Analysis"
              description="Deep insights into code structure"
            />
            <FeatureCard
              icon={<Sparkles />}
              title="Meeting Analysis"
              description="Transcribe and analyze meetings"
            />
          </div>
        </div>

        {/* Right side - Auth form */}
        {renderClerkComponent(baseTheme)}
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-sm text-muted-foreground">
        <p className="text-sm text-muted-foreground ">
          &copy; {new Date().getFullYear()}{" "}
          <Link
            href="https://sgogov.dev/"
            target="_blank"
            className="font-medium hover:underline hover:text-primary"
          >
            Stefan Gogov
          </Link>
          . All rights reserved.{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  );
}

// Helper component for feature cards
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-card border dark:border-secondary shadow-xs">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
