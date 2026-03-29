import type { NextFetchEvent, NextRequest } from "next/server";

const publicRoutes = [
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/healthz(.*)",
  "/api/webhook/stripe(.*)",
  "/api/webhook/clerk(.*)",
  "/privacy",
];

const shouldLogProxyRequest = (pathname: string) =>
  pathname.startsWith("/api/trpc") ||
  pathname.startsWith("/projects") ||
  pathname.startsWith("/dashboard");

const runClerkProxy = async (request: NextRequest, event: NextFetchEvent) => {
  if (shouldLogProxyRequest(request.nextUrl.pathname)) {
    console.log("[proxy] request", {
      pathname: request.nextUrl.pathname,
      hasClerkSecretKey: Boolean(process.env.CLERK_SECRET_KEY),
      hasClerkEncryptionKey: Boolean(process.env.CLERK_ENCRYPTION_KEY),
      hasClerkPublishableKey: Boolean(
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      ),
    });
  }

  const { clerkMiddleware, createRouteMatcher } =
    await import("@clerk/nextjs/server");

  const isPublicRoute = createRouteMatcher(publicRoutes);

  const proxy = clerkMiddleware(
    async (auth, currentRequest) => {
      if (!isPublicRoute(currentRequest)) {
        await auth.protect();
      }
    },
    {
      clockSkewInMs: 10_000,
    },
  );

  return proxy(request, event);
};

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  try {
    return await runClerkProxy(request, event);
  } catch (error) {
    console.error("[proxy] clerk middleware failed", {
      pathname: request.nextUrl.pathname,
      hasClerkSecretKey: Boolean(process.env.CLERK_SECRET_KEY),
      hasClerkEncryptionKey: Boolean(process.env.CLERK_ENCRYPTION_KEY),
      error,
    });
    throw error;
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
