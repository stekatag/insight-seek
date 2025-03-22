import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Sign up to access InsightSeek features",
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
