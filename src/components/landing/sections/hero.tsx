import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { HeroImage } from "./hero-image";

export const HeroSection = () => {
  return (
    <section className="container w-full">
      <div className="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
        <div className="text-center space-y-8">
          <Badge variant="outline" className="text-sm py-2">
            <span className="mr-2 text-primary">
              <Badge>New</Badge>
            </span>
            <span> Meeting Analysis Now Available! </span>
          </Badge>

          <div className="max-w-screen-md mx-auto text-center text-4xl md:text-6xl font-bold">
            <h1>
              AI Analysis for
              <span className="text-transparent px-2 bg-gradient-to-r from-[#D247BF] to-primary bg-clip-text">
                Code & Meetings
              </span>
            </h1>
          </div>

          <p className="max-w-screen-sm mx-auto text-xl text-muted-foreground dark:text-gray-400">
            {`Understand your GitHub repositories and team meetings with AI-powered insights. 
            Ask questions about your code, analyze commits, and extract actionable insights from meetings.`}
          </p>

          <div className="space-y-4 md:space-y-0 md:space-x-4">
            <Button asChild className="w-5/6 md:w-1/4 font-bold group/arrow">
              <Link href="/sign-up">
                <span>Start Analyzing</span>
                <ArrowRight className="size-5 group-hover/arrow:translate-x-1 transition-transform" />
              </Link>
            </Button>

            <Button
              asChild
              variant="secondary"
              className="w-5/6 md:w-1/4 font-bold "
            >
              <Link href="#features">
                <span>Explore Features</span>
                <ArrowDown className="size-5 " />
              </Link>
            </Button>
          </div>
        </div>

        {/* Client component with theme awareness */}
        <HeroImage />
      </div>
    </section>
  );
};
