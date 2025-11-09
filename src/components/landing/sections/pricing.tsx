"use client";

import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Check, CreditCard, Info } from "lucide-react";

import { createCheckoutSession } from "@/lib/stripe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { creditPackages } from "@/app/(protected)/billing/credit-packages-data";

export const PricingSection = () => {
  const handleCheckout = async (credits: number, price: number) => {
    try {
      await createCheckoutSession(credits, price);
    } catch (error) {
      console.error("Checkout error:", error);
    }
  };

  return (
    <section className="container py-24 sm:py-32 overflow-hidden">
      <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
        Pricing
      </h2>

      <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
        Flexible Pricing for Everyone
      </h2>

      <div className="md:w-3/4 lg:w-2/3 mx-auto text-center text-muted-foreground mb-16 space-y-6">
        <p className="text-xl">
          Start with{" "}
          <span className="font-bold text-primary">150 free credits</span> and
          purchase more as needed. No subscriptions or monthly fees.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="font-medium mb-2 text-foreground">
              Repository Analysis
            </p>
            <p className="text-sm sm:text-base">
              Projects typically require 50-200 credits depending on size
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="font-medium mb-2 text-foreground">Meeting Analysis</p>
            <p className="text-sm sm:text-base">
              Each minute of audio requires ~2.5 credits to process
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mt-12 px-0 sm:px-4">
        {creditPackages.map((pkg) => (
          <Card
            key={pkg.id}
            className={`flex flex-col w-full min-w-0 ${
              pkg.popular
                ? "drop-shadow-xl shadow-black/10 dark:shadow-white/10 border-[1.5px] border-primary lg:scale-[1.05]"
                : ""
            }`}
          >
            {pkg.popular && (
              <div className="absolute right-2 top-2 z-10">
                <Badge
                  variant="default"
                  className="bg-primary px-2 sm:px-3 py-1 text-xs font-medium"
                >
                  Most Popular
                </Badge>
              </div>
            )}

            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">{pkg.name}</CardTitle>
              <div className="flex flex-wrap items-baseline gap-1 sm:gap-2 mt-2">
                <span className="text-2xl sm:text-3xl font-bold">
                  ${pkg.price}
                </span>
                {pkg.regularPrice && (
                  <span className="text-muted-foreground line-through text-sm">
                    ${pkg.regularPrice}
                  </span>
                )}
                {pkg.discount && (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 ml-auto text-xs"
                  >
                    {pkg.discount}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="grow space-y-6 text-sm sm:text-base">
              <div>
                <p className="text-xl sm:text-2xl font-bold text-primary">
                  {pkg.credits.toLocaleString()} credits
                </p>
                <CardDescription className="text-xs sm:text-sm">
                  One-time purchase, never expires
                </CardDescription>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-1 sm:gap-2">
                  <Check className="text-primary h-4 w-4 shrink-0" />
                  <span className="flex items-center">
                    Up to {pkg.projectCount} project
                    {pkg.projectCount > 1 ? "s" : ""}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="ml-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px]">
                          Average project requires ~100 credits
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Check className="text-primary h-4 w-4 shrink-0" />
                  <span className="flex items-center">
                    ~{pkg.meetingMinutes} min of meetings
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="ml-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px]">
                          ~2.5 credits per minute of audio
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                </div>
                {pkg.features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-1 sm:gap-2"
                  >
                    <Check className="text-primary h-4 w-4 shrink-0" />
                    <span className="wrap-break-word">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>

            <CardFooter className="mt-auto pt-4">
              <SignedIn>
                <Button
                  variant={pkg.highlighted ? "default" : "secondary"}
                  className="w-full text-xs sm:text-sm"
                  size="default"
                  onClick={() => handleCheckout(pkg.credits, pkg.price)}
                >
                  <CreditCard className=" h-4 w-4" />
                  <span>Buy Now</span>
                </Button>
              </SignedIn>
              <SignedOut>
                <Button
                  variant={pkg.highlighted ? "default" : "secondary"}
                  className="w-full text-xs sm:text-sm"
                  size="default"
                  asChild
                >
                  <Link href="/sign-up">Get Started</Link>
                </Button>
              </SignedOut>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-muted-foreground mb-4 text-sm sm:text-base px-4">
          Need a custom amount? Create an account and choose exactly how many
          credits you need.
        </p>
        <SignedOut>
          <Button variant="outline" asChild>
            <Link href="/sign-up">Create Account</Link>
          </Button>
        </SignedOut>
        <SignedIn>
          <Button variant="outline" asChild>
            <Link href="/billing#purchase">View Custom Options</Link>
          </Button>
        </SignedIn>
      </div>
    </section>
  );
};
