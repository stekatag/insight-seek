import "@/styles/globals.css";

import { type Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";

import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || ""),
  title: {
    default: "InsightSeek | AI-powered Code & Meeting Analysis",
    template: "%s | InsightSeek",
  },
  description:
    "Understand your GitHub repositories and team meetings with AI-powered insights. Ask questions about your code, analyze commits, and extract actionable insights from meetings.",
  icons: {
    icon: [{ url: "/logo-round.svg" }],
  },
  openGraph: {
    type: "website",
    url: "https://github.com/stekatag/insight-seek",
    title: "InsightSeek | AI-powered Code & Meeting Analysis",
    description:
      "Understand your GitHub repositories and team meetings with AI-powered insights. Ask questions about your code, analyze commits, and extract actionable insights from meetings.",
    images: [
      {
        url: "/hero-image-dark.png",
        width: 1200,
        height: 630,
        alt: "InsightSeek dashboard showing code and meeting analysis",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://github.com/stekatag/insight-seek",
    title: "InsightSeek | AI-powered Code & Meeting Analysis",
    description:
      "Understand your GitHub repositories and team meetings with AI-powered insights. Ask questions about your code, analyze commits, and extract actionable insights from meetings.",
    images: ["/hero-image-dark.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${GeistSans.variable}`}>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TRPCReactProvider>{children}</TRPCReactProvider>
            <Toaster richColors />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
