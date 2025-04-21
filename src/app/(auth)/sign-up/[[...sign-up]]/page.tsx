"use client";

import { useSearchParams } from "next/navigation";
import { SignUp } from "@clerk/nextjs";

import AuthLayout from "@/components/auth/auth-layout";
import { clerkElementsStyle } from "@/components/auth/clerk-config";

// Function to safely validate the redirect URL intended for the extension
const getExtensionRedirectUrl = (param: string | null): string | null => {
  if (!param) return null;
  try {
    const url = new URL(param);
    if (url.pathname === "/auth-success") {
      // Basic security: check if origin matches the app URL if available
      // This prevents redirecting to /auth-success on a different domain
      if (
        process.env.NEXT_PUBLIC_APP_URL &&
        url.origin !== process.env.NEXT_PUBLIC_APP_URL
      ) {
        console.warn("Extension redirect URL origin mismatch");
        return null;
      }
      return param; // Return the full valid URL
    }
  } catch (e) {
    console.error("Invalid redirectUrl format:", e);
  }
  return null;
};

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const originalRedirectUrlParam = searchParams.get("redirectUrl");
  const extensionRedirectUrl = getExtensionRedirectUrl(
    originalRedirectUrlParam,
  );

  let finalForceRedirectUrl = "/sync-user"; // Default target is sync-user

  // Get base URL from environment variable
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  if (extensionRedirectUrl && appBaseUrl) {
    try {
      const syncUserUrl = new URL("/sync-user", appBaseUrl); // Use env var for base
      syncUserUrl.searchParams.set("originalRedirectUrl", extensionRedirectUrl);
      finalForceRedirectUrl = syncUserUrl.toString();
    } catch (e) {
      console.error("Error constructing syncUserUrl:", e);
      // Fallback to default if URL construction fails
      finalForceRedirectUrl = "/sync-user";
    }
  } else if (extensionRedirectUrl && !appBaseUrl) {
    console.warn(
      "NEXT_PUBLIC_APP_URL is not set. Cannot forward extension redirect param.",
    );
  }

  return (
    <AuthLayout
      mode="sign-up"
      renderClerkComponent={(baseTheme) => (
        <SignUp
          appearance={{
            baseTheme: baseTheme,
            elements: clerkElementsStyle,
          }}
          forceRedirectUrl={finalForceRedirectUrl}
        />
      )}
    />
  );
}
