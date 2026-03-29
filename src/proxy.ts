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

const runClerkProxy = async (request: NextRequest, event: NextFetchEvent) => {
  const { clerkMiddleware, createRouteMatcher } =
    await import("@clerk/nextjs/server");

  const isPublicRoute = createRouteMatcher(publicRoutes);

  const proxy = clerkMiddleware(async (auth, currentRequest) => {
    if (!isPublicRoute(currentRequest)) {
      await auth.protect();
    }
  });

  return proxy(request, event);
};

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  return runClerkProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
