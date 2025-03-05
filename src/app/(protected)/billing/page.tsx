"use client";

import { createCheckoutSession } from "@/lib/stripe";
import { api } from "@/trpc/react";
import { Package, TrendingUp } from "lucide-react";
import { useState } from "react";
import TransactionHistory from "./transaction-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { creditPackages } from "./credit-packages-data";
import { CurrentBalanceCard } from "./current-balance-card";
import { PackageCards } from "./package-cards";
import { CustomCreditAmount } from "./custom-credit-amount";
import { CreditBenefits } from "./credit-benefits";

export default function BillingPage() {
  const { data: user, isLoading } = api.project.getMyCredits.useQuery();
  const [creditsToBuy, setCreditsToBuy] = useState<number[]>([100]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [processingPackageId, setProcessingPackageId] = useState<string | null>(
    null,
  );

  const handleCheckout = async (credits: number, packagePrice?: number) => {
    // Determine which package is being processed based on credit amount
    const packageId =
      creditPackages.find((p) => p.credits === credits)?.id || "custom";
    setProcessingPackageId(packageId);
    setIsCheckingOut(true);

    try {
      await createCheckoutSession(credits, packagePrice);
    } catch (error) {
      console.error("Checkout error:", error);
      setIsCheckingOut(false);
      setProcessingPackageId(null);
    } finally {
      // In real scenario, this might not execute if redirect happens immediately
      setTimeout(() => {
        setIsCheckingOut(false);
        setProcessingPackageId(null);
      }, 3000);
    }
  };

  return (
    <div className="mx-auto max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Credits & Billing</h1>
        <p className="mt-2 text-muted-foreground">
          Purchase credits to unlock projects and meeting analyses
        </p>

        <CurrentBalanceCard credits={user?.credits} isLoading={isLoading} />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-6">
          <h2 className="text-xl font-semibold" id="purchase">
            Purchase Credits
          </h2>
          <p className="text-sm text-muted-foreground">
            Select a package or customize your credit amount
          </p>
        </div>

        <Tabs defaultValue="packages" className="px-6">
          <TabsList className="flex h-full w-full flex-col sm:flex-row md:w-[400px]">
            <TabsTrigger value="packages" className="w-full flex-1">
              <Package className="mr-2 h-4 w-4" /> Packages
            </TabsTrigger>
            <TabsTrigger value="custom" className="w-full flex-1">
              <TrendingUp className="mr-2 h-4 w-4" /> Custom Amount
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="packages"
            className="mt-6 focus-visible:outline-none focus-visible:ring-0"
          >
            <PackageCards
              packages={creditPackages}
              onCheckout={handleCheckout}
              isCheckingOut={isCheckingOut}
              processingPackageId={processingPackageId || undefined}
            />
          </TabsContent>

          <TabsContent
            value="custom"
            className="py-4 focus-visible:outline-none focus-visible:ring-0"
          >
            <CustomCreditAmount
              creditAmount={creditsToBuy}
              onCreditAmountChange={setCreditsToBuy}
              onCheckout={(credits) => handleCheckout(credits)}
              isCheckingOut={isCheckingOut}
              isProcessing={processingPackageId === "custom"}
            />
          </TabsContent>
        </Tabs>

        <CreditBenefits />
      </div>

      <div className="mt-12">
        <TransactionHistory />
      </div>
    </div>
  );
}
