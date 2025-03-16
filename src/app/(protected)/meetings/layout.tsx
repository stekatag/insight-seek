import { type Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || ""),
  title: "Meetings",
};

export default function MeetingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
