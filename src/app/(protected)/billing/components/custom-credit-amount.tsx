"use client";

import { CreditCard, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";

interface CustomCreditAmountProps {
  creditAmount: number[];
  onCreditAmountChange: (value: number[]) => void;
  onCheckout: (credits: number) => void;
  isCheckingOut: boolean;
  isProcessing: boolean;
}

export function CustomCreditAmount({
  creditAmount,
  onCreditAmountChange,
  onCheckout,
  isCheckingOut,
  isProcessing,
}: CustomCreditAmountProps) {
  const customCreditAmount = creditAmount[0]!;
  const customPrice = (customCreditAmount / 50).toFixed(2); // $2 per 100 credits

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Custom Amount</h3>
            <p className="text-sm text-muted-foreground">
              Drag the slider to select your desired amount
            </p>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-2xl font-bold">{customCreditAmount}</span>
            <span className="text-muted-foreground">credits</span>
          </div>
        </div>

        <div className="mb-8 py-4">
          <Slider
            defaultValue={[100]}
            max={2500}
            min={100}
            step={50}
            onValueChange={onCreditAmountChange}
            value={creditAmount}
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>100 credits</span>
            <span>2500 credits</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Total price:</div>
            <div className="text-2xl font-bold">${customPrice}</div>
          </div>
          <Button
            onClick={() => onCheckout(customCreditAmount)}
            disabled={isCheckingOut}
            size="lg"
            className="mt-2 md:mt-0"
          >
            {isProcessing ? (
              <>
                <Spinner size="small" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                <span>Checkout</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-md bg-muted p-4">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0">
            <Info className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Credit usage information</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Projects typically require 50-200 credits depending on repository
              size. Each minute of meeting recording requires approximately 2.5
              credits to process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
