import { type Metadata } from "next";

import BillingPage from "./page";

export const metadata: Metadata = {
  title: "Billing",
};

export default function BillingsPageLayout() {
  return <BillingPage />;
}
