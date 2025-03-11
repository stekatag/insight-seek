import { type Metadata } from "next";

import BillingPage from "./page";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || ""),
  title: "Billing",
};

export default function BillingsPageLayout() {
  return <BillingPage />;
}
