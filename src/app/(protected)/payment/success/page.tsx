"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/trpc/react";
import { CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function PaymentSuccessPage() {
  const params = useSearchParams();
  const credits = params.get("credits");
  const { data: user, isLoading } = api.user.getMyCredits.useQuery();

  return (
    <div className="container mx-auto flex max-w-lg flex-col items-center justify-center py-16">
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
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <p className="text-3xl font-bold">{user?.credits || 0} credits</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <Link href="/create" className="w-full">
            <Button className="w-full">Create a New Project</Button>
          </Link>
          <Link href="/billing" className="w-full">
            <Button variant="outline" className="w-full">
              Return to Billing
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
