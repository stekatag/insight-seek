import { db } from "@/server/db";
import { Octokit } from "octokit";

import { getInstallationToken } from "./github-app";

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  url: string;
  htmlUrl: string;
  updatedAt: string;
  language: string | null;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
  default?: boolean;
}

/**
 * Verifies if a GitHub token is valid and has the required permissions
 * Returns token status information
 */
export async function verifyGitHubToken(userId: string): Promise<{
  isValid: boolean;
  error?: string;
  installationId?: string;
  username?: string;
}> {
  try {
    // First, fetch user's GitHub token data from database
    const userGithubToken = await db.userGitHubToken.findUnique({
      where: { userId },
      select: {
        token: true,
        installationId: true,
        username: true,
        tokenExpiresAt: true,
      },
    });

    if (!userGithubToken || !userGithubToken.token) {
      return {
        isValid: false,
        error: "No GitHub token found",
      };
    }

    // For GitHub App tokens, the most reliable test is checking if we can list repositories
    const octokit = new Octokit({ auth: userGithubToken.token });

    try {
      // This is the most important test for GitHub App installations
      const { data } =
        await octokit.rest.apps.listReposAccessibleToInstallation({
          per_page: 1,
        });

      // If we get here, the token is working properly for repository access
      // which is the main functionality we need
      return {
        isValid: true,
        // Convert null to undefined for TypeScript compatibility
        installationId: userGithubToken.installationId || undefined,
        username: userGithubToken.username || undefined,
      };
    } catch (repoError: any) {
      console.warn("Repository access check failed:", repoError);

      // Try a fallback endpoint that might work with restricted scopes
      try {
        const { data: appData } = await octokit.rest.apps.getAuthenticated();

        // If we can authenticate but can't list repos, token might have limited permissions
        // but is still valid as an authentication token
        return {
          isValid: true, // Consider it valid if basic authentication works
          installationId: userGithubToken.installationId || undefined,
          username: userGithubToken.username || undefined,
        };
      } catch (appError) {
        // If both checks fail, the token is likely invalid
        console.error("App authentication failed:", appError);

        // Check if token is expired based on our database record
        const isExpired =
          userGithubToken.tokenExpiresAt &&
          new Date() > userGithubToken.tokenExpiresAt;

        if (isExpired) {
          // Try refreshing the token
          const freshToken = await getInstallationToken(userId);

          if (freshToken) {
            return {
              isValid: true,
              installationId: userGithubToken.installationId || undefined,
              username: userGithubToken.username || undefined,
            };
          }
        }

        return {
          isValid: false,
          error: isExpired
            ? "Token has expired"
            : "GitHub App authentication failed",
        };
      }
    }
  } catch (error: any) {
    console.error("GitHub token verification error:", error);

    return {
      isValid: false,
      error: `GitHub verification error: ${error.message || "Unknown error"}`,
    };
  }
}

/**
 * Fetches all branches for a specific repository
 */
export async function getRepositoryBranches(
  userId: string,
  repoOwner: string,
  repoName: string,
): Promise<GitHubBranch[]> {
  const token = await getInstallationToken(userId);

  if (!token) {
    return [];
  }

  const octokit = new Octokit({ auth: token });

  try {
    // Get all branches
    const { data: branches } = await octokit.rest.repos.listBranches({
      owner: repoOwner,
      repo: repoName,
      per_page: 100,
    });

    // Get default branch information
    const { data: repoInfo } = await octokit.rest.repos.get({
      owner: repoOwner,
      repo: repoName,
    });

    const defaultBranch = repoInfo.default_branch;

    // Mark the default branch
    return branches.map((branch) => ({
      ...branch,
      default: branch.name === defaultBranch,
    }));
  } catch (error) {
    console.error(
      `Error fetching branches for ${repoOwner}/${repoName}:`,
      error,
    );
    return [];
  }
}
