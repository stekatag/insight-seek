import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server"; // Import NextRequest
import { db } from "@/server/db";
import { auth, clerkClient } from "@clerk/nextjs/server";

// Route handler for GET requests to /sync-user
export async function GET(request: NextRequest) {
  // Get searchParams from the request URL
  const searchParams = request.nextUrl.searchParams;
  const originalRedirectUrlParam = searchParams.get("originalRedirectUrl");

  let validExtensionRedirect = false;
  let validatedUrl = "";

  // Validate the param synchronously
  if (
    typeof originalRedirectUrlParam === "string" &&
    originalRedirectUrlParam.length > 0
  ) {
    try {
      const parsedRedirectUrl = new URL(originalRedirectUrlParam);
      if (parsedRedirectUrl.pathname === "/auth-success") {
        if (
          process.env.NEXT_PUBLIC_APP_URL &&
          parsedRedirectUrl.origin !== process.env.NEXT_PUBLIC_APP_URL
        ) {
          console.warn(
            "SyncUser Route: originalRedirectUrlParam origin mismatch",
          );
        } else {
          validExtensionRedirect = true;
          validatedUrl = originalRedirectUrlParam;
        }
      } else {
        console.warn(
          `SyncUser Route: Invalid originalRedirectUrl pathname: ${parsedRedirectUrl.pathname}`,
        );
      }
    } catch (e) {
      console.error(
        "SyncUser Route: Invalid originalRedirectUrl parameter format",
        e,
      );
    }
  }

  // Perform async operations
  const { userId } = await auth();
  if (!userId) {
    console.error("SyncUser Route: User not found during sync");
    // Redirect to sign-in or return an error response
    return redirect("/sign-in"); // Or NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    if (!user.emailAddresses[0]?.emailAddress) {
      console.error(
        "SyncUser Route: User found in Clerk but has no email address during sync",
      );
      // Return an error response or redirect
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 },
      );
    }

    await db.user.upsert({
      where: { emailAddress: user.emailAddresses[0].emailAddress },
      update: {
        imageUrl: user.imageUrl,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      create: {
        id: userId,
        emailAddress: user.emailAddresses[0].emailAddress,
        imageUrl: user.imageUrl,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error(
      "SyncUser Route: Error during async operations (auth/db):",
      error,
    );
    // Return a generic server error response
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }

  // Perform final redirect based on the flag
  if (validExtensionRedirect) {
    return redirect(validatedUrl); // Use Next.js redirect
  }

  return redirect("/dashboard"); // Use Next.js redirect
}
