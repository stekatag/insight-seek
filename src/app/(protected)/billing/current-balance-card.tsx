"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface CurrentBalanceCardProps {
  credits?: number;
  isLoading: boolean;
}

export function CurrentBalanceCard({
  credits,
  isLoading,
}: CurrentBalanceCardProps) {
  if (isLoading) {
    return (
      <div className="mt-6 flex items-center rounded-lg border bg-background p-4">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Your current balance</p>
          <Skeleton className="mt-1 h-8 w-24" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
    );
  }

  return (
    <div className="mt-6 flex items-center rounded-lg border bg-background p-4">
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">Your current balance</p>
        <p className="text-2xl font-bold">{credits || 0} credits</p>
      </div>
      <Button asChild variant="outline">
        <a href="#purchase">Purchase more credits</a>
      </Button>
    </div>
  );
}
