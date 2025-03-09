import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // GitHub App installation URL with the correct format
  const githubAppName = process.env.GITHUB_APP_NAME || "insightseek";

  // Store the user ID in the state parameter to associate the installation with the right user
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  // Simplify the URL format - this is the URL format that works
  const installUrl = `https://github.com/apps/${githubAppName}/installations/new?state=${state}`;

  return NextResponse.redirect(installUrl);
}
