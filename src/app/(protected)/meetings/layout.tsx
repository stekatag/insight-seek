import { type Metadata } from "next";

import MeetingPage from "./page";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || ""),
  title: "Meetings",
};

export default function MeetingsLayout() {
  return <MeetingPage />;
}
