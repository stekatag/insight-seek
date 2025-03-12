// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { Octokit } from "octokit";

import { checkCredits } from "./github-loader";

export interface ValidationResult {
  isValid: boolean;
  isPublic: boolean;
  repoFullName?: string;
  error?: string;
  fileCount?: number;
  defaultBranch?: string;
  branches?: string[];
}

/**
 * Validates a GitHub repository URL and access token
 * @param githubUrl The URL of the GitHub repository
 * @param githubToken Optional GitHub access token for private repositories
 */
export async function validateGitHubRepo(
  githubUrl: string,
  githubToken?: string,
): Promise<ValidationResult> {
  try {
    // Parse GitHub URL to extract owner and repo
    const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/i;
    const match = githubUrl.match(urlPattern);

    if (!match) {
      return {
        isValid: false,
        isPublic: false,
        error:
          "Invalid GitHub URL format. Please enter a valid GitHub repository URL.",
      };
    }

    const owner = match[1];
    const repo = match[2].split(".")[0]; // Remove .git if present
    const repoFullName = `${owner}/${repo}`;

    // Create Octokit instance with or without token
    const octokit = githubToken
      ? new Octokit({ auth: githubToken })
      : new Octokit();

    // Try to get repository details
    try {
      // Get basic repo info
      const { data: repoData } = await octokit.rest.repos.get({
        owner,
        repo,
      });

      // Get repository branches
      const { data: branchData } = await octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100, // Increased to get more branches
      });

      // Use the default branch and checkCredits to get the accurate file count
      const defaultBranch = repoData.default_branch;

      // We'll return the repository info immediately to improve UI responsiveness
      // File count will be calculated separately via checkCredits when needed
      return {
        isValid: true,
        isPublic: !repoData.private,
        repoFullName,
        defaultBranch: defaultBranch,
        branches: branchData.map((branch) => branch.name),
        // No fileCount here - this will be provided by the checkCredits function
      };
    } catch (error: any) {
      if (error.status === 404) {
        // Repository not found - could be private or doesn't exist
        return {
          isValid: false,
          isPublic: false,
          error: githubToken
            ? "Repository not found. Check that the URL is correct and your token has access to this repository."
            : "Repository not found. If this is a private repository, please provide a GitHub token.",
        };
      } else if (error.status === 401 || error.status === 403) {
        // Authentication issue
        return {
          isValid: false,
          isPublic: false,
          error: "Authentication failed. Please check your GitHub token.",
        };
      } else {
        // Other errors
        return {
          isValid: false,
          isPublic: false,
          error: `Failed to access repository: ${error.message}`,
        };
      }
    }
  } catch (error) {
    return {
      isValid: false,
      isPublic: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
