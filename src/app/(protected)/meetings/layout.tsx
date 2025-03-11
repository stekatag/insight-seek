import { type Metadata } from "next";

import MeetingPage from "./page";

export const metadata: Metadata = {
  title: "Meetings",
};

export default function MeetingsLayout() {
  return <MeetingPage />;
}
