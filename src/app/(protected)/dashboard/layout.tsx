import { type Metadata } from "next";

import DashboardPage from "./page";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || ""),
  title: "Dashboard",
};

export default function DashboardLayout() {
  return <DashboardPage />;
}
