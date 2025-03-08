import { Presentation, Sparkles } from "lucide-react";

export function CreditBenefits() {
  return (
    <div className="space-y-1 bg-muted/50 p-6">
      <div className="flex items-center text-sm">
        <Sparkles className="mr-2 h-4 w-4 text-primary" />
        <span>Credits never expire and can be used at any time</span>
      </div>
      <div className="flex items-center text-sm">
        <Presentation className="mr-2 h-4 w-4 text-primary" />
        <span>~2.5 credits per minute of meeting recording</span>
      </div>
    </div>
  );
}
