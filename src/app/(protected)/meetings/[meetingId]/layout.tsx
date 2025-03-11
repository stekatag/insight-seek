import { type Metadata } from "next";

import MeetingDetailPage from "./page";

export const metadata: Metadata = {
  title: "Meeting Details",
};

export default function MeetingDetailPageLayout() {
  return <MeetingDetailPage />;
}
