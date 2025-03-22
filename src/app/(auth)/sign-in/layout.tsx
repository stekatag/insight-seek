import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to access InsightSeek features",
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
