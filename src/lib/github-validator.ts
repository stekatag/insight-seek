import { Octokit } from "octokit";

export interface ValidationResult {
  isValid: boolean;
  isPublic: boolean;
  repoFullName?: string;
  error?: string;
  fileCount?: number;
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
      const { data } = await octokit.rest.repos.get({
        owner,
        repo,
      });

      // Get approximate file count (can be expanded later)
      const fileCount = await getApproximateFileCount(octokit, owner, repo);

      return {
        isValid: true,
        isPublic: !data.private,
        repoFullName,
        fileCount,
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

/**
 * Gets an approximate count of files in the repository
 */
async function getApproximateFileCount(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<number> {
  try {
    // This is a simplified approach - for a more accurate count,
    // you would need to recursively traverse the repository
    const { data } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: "HEAD",
      recursive: "1", // Get all files recursively
    });

    // Count only blobs (files) and not trees (directories)
    return data.tree.filter((item) => item.type === "blob").length;
  } catch (error) {
    // Fall back to a default value if we can't get an accurate count
    return 50; // Default estimate
  }
}
