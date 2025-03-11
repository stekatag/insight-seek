import { type Metadata } from "next";

import CreatePage from "./page";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || ""),
  title: "New Project",
};

export default function CreateProjectPageLayout() {
  return <CreatePage />;
}
