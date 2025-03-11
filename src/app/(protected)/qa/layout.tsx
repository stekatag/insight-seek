import { type Metadata } from "next";

import QAPage from "./page";

export const metadata: Metadata = {
  title: "Q&A",
};

export default function QAPageLayout() {
  return <QAPage />;
}
