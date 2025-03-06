import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <SignIn
      path={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL}
      forceRedirectUrl="/sync-user"
    />
  );
}
