import Link from "next/link";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { ArrowRight, Mic } from "lucide-react";

import { Button } from "@/components/ui/button";

export const CTASection = () => {
  return (
    <section
      id="cta"
      className="border-t border-b border-secondary bg-secondary/10"
    >
      <div className="container py-24 sm:py-32">
        <div className="flex flex-col items-center justify-center gap-8 text-center">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <GitHubLogoIcon className="h-8 w-8 text-primary" />
              <span className="text-xl font-medium">+</span>
              <Mic className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold md:text-4xl lg:text-5xl">
              Ready to{" "}
              <span className="text-transparent bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                enhance
              </span>{" "}
              your development workflow?
            </h2>
            <p className="mx-auto max-w-[85%] text-xl text-muted-foreground">
              Join developers who are using InsightSeek to understand code
              faster and extract insights from meetings. Start with our free
              tier today.
            </p>
          </div>

          <div className="flex flex-col gap-4 min-[400px]:flex-row">
            <Button asChild size="lg" className="gap-2 text-base">
              <Link href="/sign-up">
                Get Started
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
