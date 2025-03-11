import { type Metadata } from "next";

import QAPage from "./page";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || ""),
  title: "Q&A",
};

export default function QAPageLayout() {
  return <QAPage />;
}
