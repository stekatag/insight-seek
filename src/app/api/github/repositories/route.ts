import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch the GitHub installation details directly from the database
    const userToken = await db.userGitHubToken.findUnique({
      where: { userId },
      select: {
        token: true,
        installationId: true,
        tokenExpiresAt: true,
      },
    });

    if (!userToken || !userToken.installationId) {
      return NextResponse.json({
        repositories: [],
        error: "No GitHub installation found",
      });
    }

    // Always generate a fresh token to avoid JWT decoding issues
    let token: string;

    try {
      // Create a new token using the installation ID
      const appAuth = createAppAuth({
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
        installationId: userToken.installationId,
      });

      // Get a fresh token with repository permissions
      const authResult = await appAuth({
        type: "installation",
        // Explicitly specify permissions for repo access
        repositoryIds: [], // Access all repositories
        permissions: {
          contents: "read",
          metadata: "read",
        },
      });

      token = authResult.token;

      // Update the token in the database with the new expiration time
      await db.userGitHubToken.update({
        where: { userId },
        data: {
          token,
          tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });
    } catch (tokenError) {
      console.error("Failed to generate GitHub token:", tokenError);
      return NextResponse.json({
        repositories: [],
        error: "Failed to authenticate with GitHub",
      });
    }

    // Use the fresh token to access repositories
    const octokit = new Octokit({ auth: token });

    try {
      console.log("Fetching repositories with installation token");
      const { data } =
        await octokit.rest.apps.listReposAccessibleToInstallation({
          per_page: 100,
        });

      if (!data.repositories || data.repositories.length === 0) {
        console.log("No repositories found in GitHub App installation");
        return NextResponse.json({ repositories: [] });
      }

      console.log(`Found ${data.repositories.length} repositories`);

      // Map the repositories to our format
      const repositories = data.repositories.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        url: repo.url,
        htmlUrl: repo.html_url,
        updatedAt: repo.updated_at || "",
        language: repo.language,
      }));

      // Sort by name for better display
      repositories.sort((a, b) => a.fullName.localeCompare(b.fullName));

      return NextResponse.json({ repositories });
    } catch (apiError) {
      console.error("GitHub API error fetching repositories:", apiError);
      return NextResponse.json({
        repositories: [],
        error: "Failed to fetch repositories from GitHub",
        details:
          apiError instanceof Error ? apiError.message : String(apiError),
      });
    }
  } catch (error) {
    console.error("Error in repositories API:", error);
    return NextResponse.json(
      {
        repositories: [],
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
