"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, CreditCard, Loader2, Plus } from "lucide-react";

import { api } from "@/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// Client component that uses useSearchParams
function PaymentSuccessContent() {
  const params = useSearchParams();
  const credits = params.get("credits");
  const { data: user, isLoading } = api.user.getMyCredits.useQuery();

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <CardTitle className="text-2xl">Payment Successful!</CardTitle>
        <CardDescription>
          {credits
            ? `You have purchased ${credits} credits`
            : "Your payment has been processed successfully"}
        </CardDescription>
      </CardHeader>

      <CardContent className="text-center">
        <div className="rounded-lg bg-muted p-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Your Current Balance
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size="medium" />
            </div>
          ) : (
            <p className="text-3xl font-bold">{user?.credits || 0} credits</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <Link href="/create" className="w-full">
          <Button className="w-full">
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </Button>
        </Link>
        <Link href="/billing" className="w-full">
          <Button variant="outline" className="w-full">
            <CreditCard className="h-4 w-4" />
            <span>Return to Billing</span>
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

// Main page component with Suspense
export default function PaymentSuccessPage() {
  return (
    <div className="container mx-auto flex max-w-lg flex-col items-center justify-center py-16">
      <Suspense
        fallback={
          <Card className="w-full">
            <CardContent className="flex items-center justify-center py-12">
              <Spinner size="large" />
            </CardContent>
          </Card>
        }
      >
        <PaymentSuccessContent />
      </Suspense>
    </div>
  );
}
