import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";

export async function GET(req: NextRequest) {
  // Get current authenticated user
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);

  // Get installation ID and setup action from query params
  const installationId = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action");
  const state = url.searchParams.get("state");

  // Validate state if present
  let stateData: { userId: string } | null = null;
  if (state) {
    try {
      stateData = JSON.parse(Buffer.from(state, "base64").toString());
      // Verify the state matches the current user
      if (!stateData || stateData.userId !== userId) {
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
      }
    } catch (error) {
      console.error("Error parsing state:", error);
      return NextResponse.json(
        { error: "Invalid state format" },
        { status: 400 },
      );
    }
  }

  if (!installationId) {
    return NextResponse.redirect(
      new URL("/create?error=no_installation_id", req.url),
    );
  }

  try {
    // Create GitHub App authentication
    const appAuth = createAppAuth({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
      installationId,
    });

    // Get an installation access token with explicit permissions
    const { token } = await appAuth({
      type: "installation",
      repositoryIds: [], // No specific repos, access all in the installation
      permissions: {
        contents: "read",
        metadata: "read",
      },
    });

    try {
      // Verify the token works by making a simple API call
      const octokit = new Octokit({ auth: token });
      await octokit.rest.apps.listReposAccessibleToInstallation({
        per_page: 1,
      });
    } catch (verifyError) {
      console.error("Token verification failed:", verifyError);
      return NextResponse.redirect(
        new URL("/create?error=token_verification_failed", req.url),
      );
    }

    // Store the installation details
    await db.userGitHubToken.upsert({
      where: { userId },
      update: {
        token,
        installationId,
        // Store the timestamp when the token was generated
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // GitHub tokens expire after 1 hour
      },
      create: {
        userId,
        token,
        installationId,
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Redirect back to the create page with a success message
    return NextResponse.redirect(
      new URL(
        "/create?github_connected=true&setup_action=" +
          (setupAction || "install"),
        req.url,
      ),
    );
  } catch (error) {
    console.error("Error handling GitHub callback:", error);
    return NextResponse.redirect(
      new URL("/create?error=github_auth_error", req.url),
    );
  }
}
