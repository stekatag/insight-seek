import { type Metadata } from "next";

import DashboardPage from "./page";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardLayout() {
  return <DashboardPage />;
}
