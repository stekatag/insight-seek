"use client";

import { SignIn } from "@clerk/nextjs";

import AuthLayout from "@/components/auth/auth-layout";
import { clerkElementsStyle } from "@/components/auth/clerk-config";

export default function SignInPage() {
  return (
    <AuthLayout
      mode="sign-in"
      renderClerkComponent={(baseTheme) => (
        <SignIn
          appearance={{
            baseTheme: baseTheme,
            elements: clerkElementsStyle,
          }}
          forceRedirectUrl="/dashboard"
        />
      )}
    />
  );
}
