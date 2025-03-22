import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { GitHubLogoIcon } from "@radix-ui/react-icons";

import { Separator } from "@/components/ui/separator";
import ApplicationLogo from "@/components/application-logo";

// Add isStandalonePage prop with default value
interface FooterSectionProps {
  isStandalonePage?: boolean;
}

export const FooterSection = ({
  isStandalonePage = false,
}: FooterSectionProps) => {
  // Helper function to get correct href based on current page
  const getHref = (href: string) => {
    if (!isStandalonePage || !href.startsWith("#")) return href;
    return "/" + href;
  };

  return (
    <footer id="footer" className="container py-14 sm:py-20">
      <div className="p-6 sm:p-10 bg-card border border-secondary rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8">
          <div className="col-span-1 sm:col-span-2">
            <Link href="/" className="flex font-bold items-center">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground mr-2">
                <ApplicationLogo className="p-1.5" />
              </div>
              <h3 className="text-2xl">InsightSeek</h3>
            </Link>
            <p className="mt-4 text-muted-foreground max-w-xs">
              AI-powered insights for your code repositories and team meetings.
              Ask questions, analyze commits, and extract actionable insights.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg">Navigation</h3>
            <div>
              <Link
                href={getHref("#features")}
                className="opacity-60 hover:opacity-100"
              >
                Features
              </Link>
            </div>
            <div>
              <Link
                href={getHref("#testimonials")}
                className="opacity-60 hover:opacity-100"
              >
                Testimonials
              </Link>
            </div>
            <div>
              <Link
                href={getHref("#contact")}
                className="opacity-60 hover:opacity-100"
              >
                Contact
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg">Account</h3>
            <SignedIn>
              <div>
                <Link
                  href="/dashboard"
                  className="opacity-60 hover:opacity-100"
                >
                  Dashboard
                </Link>
              </div>
              <div>
                <Link href="/projects" className="opacity-60 hover:opacity-100">
                  Projects
                </Link>
              </div>
              <div>
                <Link href="/meetings" className="opacity-60 hover:opacity-100">
                  Meetings
                </Link>
              </div>
            </SignedIn>
            <SignedOut>
              <div>
                <Link href="/sign-in" className="opacity-60 hover:opacity-100">
                  Sign In
                </Link>
              </div>
              <div>
                <Link href="/sign-up" className="opacity-60 hover:opacity-100">
                  Get Started
                </Link>
              </div>
            </SignedOut>
          </div>
        </div>

        <Separator className="my-6" />
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="text-sm text-muted-foreground mb-4 sm:mb-0">
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
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/stekatag/insight-seek"
              target="_blank"
              className="opacity-60 hover:opacity-100 flex items-center gap-2"
            >
              <GitHubLogoIcon className="h-5 w-5" />
              <span>GitHub</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
