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

  const url = new URL(req.url);
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "Owner and repo parameters are required" },
      { status: 400 },
    );
  }

  try {
    // Fetch the GitHub installation directly from the database
    const userToken = await db.userGitHubToken.findUnique({
      where: { userId },
      select: {
        installationId: true,
      },
    });

    if (!userToken || !userToken.installationId) {
      return NextResponse.json({
        branches: [],
        error: "No GitHub installation found",
      });
    }

    // Always generate a fresh token
    try {
      // Create a new token using the installation ID
      const appAuth = createAppAuth({
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
        installationId: userToken.installationId,
      });

      // Get a fresh token
      const { token } = await appAuth({
        type: "installation",
        repositoryIds: [], // Access all repositories
        permissions: {
          contents: "read",
          metadata: "read",
        },
      });

      // Create an Octokit instance with the fresh token
      const octokit = new Octokit({ auth: token });

      // Get all branches
      const { data: branches } = await octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      });

      // Get default branch information
      const { data: repoInfo } = await octokit.rest.repos.get({
        owner,
        repo,
      });

      const defaultBranch = repoInfo.default_branch;

      // Mark the default branch
      const formattedBranches = branches.map((branch) => ({
        ...branch,
        default: branch.name === defaultBranch,
      }));

      return NextResponse.json({ branches: formattedBranches });
    } catch (error: any) {
      console.error(`Error fetching branches for ${owner}/${repo}:`, error);

      return NextResponse.json({
        branches: [],
        error: "Failed to fetch repository branches",
        message: error?.message || "Unknown error occurred",
      });
    }
  } catch (error: any) {
    console.error(`Unexpected error processing branches request:`, error);

    return NextResponse.json(
      {
        branches: [],
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
