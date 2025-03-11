import { type Metadata } from "next";

import MeetingDetailPage from "./page";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || ""),
  title: "Meeting Details",
};

export default function MeetingDetailPageLayout() {
  return <MeetingDetailPage />;
}
