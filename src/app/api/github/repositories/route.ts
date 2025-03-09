import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getUserRepositories } from "@/lib/github-api";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repositories = await getUserRepositories(userId);

    // Return the repositories even if the array is empty
    return NextResponse.json({ repositories });
  } catch (error: any) {
    console.error("Error fetching repositories:", error);

    // Check if we have an HTTP error status from GitHub API
    const statusCode = error?.status || 500;
    const errorMessage = error?.message || "Failed to fetch repositories";

    // Provide more informative error message
    return NextResponse.json(
      {
        error: errorMessage,
        message:
          "There was an issue accessing your GitHub repositories. Ensure your GitHub App has the necessary permissions.",
        details: error?.documentation_url || undefined,
      },
      { status: statusCode },
    );
  }
}
