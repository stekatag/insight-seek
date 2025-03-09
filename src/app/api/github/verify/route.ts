import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";

import { verifyGitHubToken } from "@/lib/github-api";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if the token exists and is valid
    const verificationResult = await verifyGitHubToken(userId);

    return NextResponse.json(verificationResult);
  } catch (error) {
    console.error("Error verifying GitHub token:", error);
    return NextResponse.json(
      { error: "Failed to verify GitHub token" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Delete the GitHub token for this user
    await db.userGitHubToken
      .delete({
        where: { userId },
      })
      .catch(() => {
        // If no token exists, that's fine
        console.log("No GitHub token found to delete");
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing GitHub token:", error);
    return NextResponse.json(
      { error: "Failed to remove GitHub connection" },
      { status: 500 },
    );
  }
}
