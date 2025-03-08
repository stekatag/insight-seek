"use client";

import { Check, CreditCard, Info, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { CreditPackage } from "../credit-packages-data";

interface PackageCardsProps {
  packages: CreditPackage[];
  onCheckout: (credits: number, price: number) => void;
  isCheckingOut: boolean;
  processingPackageId?: string;
}

export function PackageCards({
  packages,
  onCheckout,
  isCheckingOut,
  processingPackageId,
}: PackageCardsProps) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {packages.map((pkg) => (
        <Card
          key={pkg.id}
          className={cn(
            "relative flex flex-col overflow-hidden transition-all hover:shadow-md",
            pkg.highlighted &&
              "scale-[1.02] border-primary shadow-md ring-1 ring-primary",
          )}
        >
          {pkg.popular && (
            <div className="absolute right-1 top-1 z-10">
              <div className="rounded-xl bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Most Popular
              </div>
            </div>
          )}

          <CardHeader className="flex-none">
            <CardTitle className="flex items-center">
              <span>{pkg.name}</span>
              {pkg.discount && (
                <Badge
                  variant="outline"
                  className="ml-2 bg-green-50 text-green-700"
                >
                  {pkg.discount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              <div className="mt-1 flex items-baseline">
                <span className="text-3xl font-bold">${pkg.price}</span>
                {pkg.regularPrice && (
                  <span className="ml-2 text-sm text-muted-foreground line-through">
                    ${pkg.regularPrice}
                  </span>
                )}
                <span className="ml-1 text-muted-foreground">/ one-time</span>
              </div>
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-grow">
            <p className="mb-4 text-2xl font-bold text-primary">
              {pkg.credits.toLocaleString()} credits
            </p>

            <Separator className="my-4" />

            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>Up to {pkg.projectCount} projects</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="ml-1 h-3.5 w-3.5 cursor-help text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Average project requires ~100 credits
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </li>
              <li className="flex items-center">
                <Check className="mr-2 h-4 w-4 text-green-500" />
                <span>~{pkg.meetingMinutes} min of meetings</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="ml-1 h-3.5 w-3.5 cursor-help text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      ~2.5 credits per minute of audio
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </li>
              {pkg.features.map((feature, idx) => (
                <li key={idx} className="flex items-center">
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>

          <CardFooter className="mt-auto flex-none pt-6">
            <Button
              className={cn(
                "relative w-full",
                pkg.highlighted && "bg-primary hover:bg-primary/90",
              )}
              onClick={() => onCheckout(pkg.credits, pkg.price)}
              disabled={isCheckingOut}
            >
              {isCheckingOut && processingPackageId === pkg.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>Purchase</span>
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
