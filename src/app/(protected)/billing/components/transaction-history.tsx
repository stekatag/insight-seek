"use client";

import { api } from "@/trpc/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ReceiptIcon } from "lucide-react";

export default function TransactionHistory() {
  const { data: transactions, isLoading } =
    api.user.getStripeTransactions.useQuery();

  if (isLoading) {
    return (
      <div>
        <h2 className="text-xl font-semibold">Transaction History</h2>
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md border p-4"
            >
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-semibold">Transaction History</h2>
        <div className="mt-4 flex h-32 flex-col items-center justify-center rounded-lg border border-dashed">
          <ReceiptIcon className="mb-2 h-8 w-8 text-muted-foreground/70" />
          <p className="text-muted-foreground">No transactions yet</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Transaction History</h2>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="font-medium">
                  {formatDistanceToNow(transaction.createdAt, {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell>+{transaction.credits} credits</TableCell>
                <TableCell className="text-right">
                  ${(transaction.credits / 50).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
