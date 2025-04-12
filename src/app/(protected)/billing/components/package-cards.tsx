"use client";

import { Check, CreditCard, Info } from "lucide-react";

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
import { Spinner } from "@/components/ui/spinner";
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
            "relative flex flex-col overflow-hidden transition-all hover:shadow-md border border-secondary",
            pkg.highlighted &&
              "scale-[1.02] border-primary shadow-md ring-1 ring-primary",
          )}
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
              variant={pkg.highlighted ? "default" : "secondary"}
              className={cn(
                "relative w-full",
                pkg.highlighted && "bg-primary hover:bg-primary/90",
              )}
              onClick={() => onCheckout(pkg.credits, pkg.price)}
              disabled={isCheckingOut}
            >
              {isCheckingOut && processingPackageId === pkg.id ? (
                <>
                  <Spinner size="small" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>Buy Now</span>
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
