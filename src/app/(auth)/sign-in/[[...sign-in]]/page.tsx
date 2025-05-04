"use client";

import { useSearchParams } from "next/navigation";
import { SignIn } from "@clerk/nextjs";

import AuthLayout from "@/components/auth/auth-layout";
import { clerkElementsStyle } from "@/components/auth/clerk-config";

// Function to safely validate the redirect URL
const getValidatedRedirectUrl = (param: string | null): string | null => {
  if (!param) return null;
  try {
    const url = new URL(param);
    // Add origin check for better security if needed:
    // && url.origin === window.location.origin
    if (url.pathname === "/auth-success") {
      return param; // Return the full valid URL
    }
  } catch (e) {
    console.error("Invalid redirectUrl format:", e);
  }
  return null;
};

export default function SignInPage() {
  const searchParams = useSearchParams();
  const redirectUrlParam = searchParams
    ? searchParams.get("redirectUrl")
    : null;
  const validatedRedirectUrl = getValidatedRedirectUrl(redirectUrlParam);

  // Use the validated URL if present, otherwise default to /dashboard
  const finalForceRedirectUrl = validatedRedirectUrl || "/dashboard";
  console.log(
    `SignInPage: Setting forceRedirectUrl to: ${finalForceRedirectUrl}`,
  );

  return (
    <AuthLayout
      mode="sign-in"
      renderClerkComponent={(baseTheme) => (
        <SignIn
          appearance={{
            baseTheme: baseTheme,
            elements: clerkElementsStyle,
          }}
          forceRedirectUrl={finalForceRedirectUrl} // Use the dynamic forceRedirectUrl
        />
      )}
    />
  );
}
