"use client";

import { SignUp } from "@clerk/nextjs";

import AuthLayout from "@/components/auth/auth-layout";
import { clerkElementsStyle } from "@/components/auth/clerk-config";

export default function SignUpPage() {
  return (
    <AuthLayout
      mode="sign-up"
      renderClerkComponent={(baseTheme) => (
        <SignUp
          appearance={{
            baseTheme: baseTheme,
            elements: clerkElementsStyle,
          }}
        />
      )}
    />
  );
}
