import { db } from "@/server/db";
import { Octokit } from "octokit";

import { getInstallationToken } from "./github-app";

/**
 * Creates an authenticated Octokit instance with improved timeout and retry settings
 * @param userToken Optional user-provided token for private repositories
 */
export function createRobustOctokit(userToken?: string, signal?: AbortSignal) {
  return new Octokit({
    auth: userToken,
    request: {
      // Increase timeout to handle larger repositories
      timeout: 40000, // 40 seconds
      signal,
    },
  });
}

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
    const octokit = createRobustOctokit(userGithubToken.token);

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

  const octokit = createRobustOctokit(token);

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

export function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/i);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid GitHub URL format: ${url}`);
  }
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

// Helper function to extract files from git diff
export function extractFilesFromDiff(diffContent: string): string[] {
  if (!diffContent || typeof diffContent !== "string") {
    console.error("Invalid diff content:", diffContent);
    return [];
  }

  console.log("Analyzing diff content for file changes...");

  const modifiedFiles = new Set<string>();

  // Use multiple patterns to capture file paths
  const diffFileRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
  const fileHeaderRegex = /^(\+\+\+|---) [ab]\/(.+?)$/gm;

  // Check standard git diff format
  let match;
  while ((match = diffFileRegex.exec(diffContent)) !== null) {
    if (match[2]) {
      const path = match[2].trim();
      console.log(`Found modified file (diff format): ${path}`);
      modifiedFiles.add(path);
    }
  }

  // Check unified diff format
  while ((match = fileHeaderRegex.exec(diffContent)) !== null) {
    if (match[2]) {
      const path = match[2].trim();
      console.log(`Found modified file (header format): ${path}`);
      modifiedFiles.add(path);
    }
  }

  // Log diagnostic info for debugging
  if (modifiedFiles.size === 0) {
    console.log(
      "No files detected with standard patterns, checking raw diff...",
    );
    // console.log("Diff content sample:", diffContent.substring(0, 500) + "..."); // Avoid logging potentially large diffs
  }

  const files = Array.from(modifiedFiles);
  console.log(`Total modified files from diff: ${files.length}`);
  return files;
}

// Helper to determine if a file should be processed
export function shouldProcessFile(filePath: string): boolean {
  // Skip binary files, images, etc.
  const excludedExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".ttf",
    ".woff",
    ".woff2",
    ".eot",
    ".mp3",
    ".mp4",
    ".webm",
    ".pdf",
    ".zip",
    ".tar.gz",
    ".jar",
    ".exe",
    ".bin",
  ];

  // Skip configuration files, lock files, etc.
  const excludedFilePatterns = [
    "package-lock.json",
    "bun.lockb",
    "pnpm-lock.yaml",
    "Gemfile.lock",
    "poetry.lock",
    "yarn.lock",
    ".gitignore",
    ".gitattributes",
    ".gitmodules",
    ".npmrc",
    ".yarnrc",
    ".editorconfig",
    ".eslintignore",
    ".prettierignore",
    ".env",
    "LICENSE",
  ];

  // Skip common build/dependency directories
  const excludedDirPatterns = [
    "node_modules/",
    "dist/",
    "build/",
    ".next/",
    "out/",
    "vendor/",
    ".venv/",
    "target/", // Rust/Java
    "Pods/", // iOS
    ".gradle/", // Android/Gradle
  ];

  const lowerFilePath = filePath.toLowerCase();

  // Check excluded extensions
  if (excludedExtensions.some((ext) => lowerFilePath.endsWith(ext))) {
    // console.log(`File ${filePath} excluded due to extension`);
    return false;
  }

  // Check specific excluded filenames
  if (excludedFilePatterns.some((pattern) => lowerFilePath.endsWith(pattern))) {
    // console.log(`File ${filePath} excluded due to pattern match (filename)`);
    return false;
  }

  // Check excluded directory patterns
  if (excludedDirPatterns.some((pattern) => lowerFilePath.includes(pattern))) {
    // console.log(`File ${filePath} excluded due to pattern match (directory)`);
    return false;
  }

  // Skip minified files
  if (
    lowerFilePath.includes(".min.") ||
    lowerFilePath.endsWith(".min.js") ||
    lowerFilePath.endsWith(".min.css")
  ) {
    // console.log(`File ${filePath} excluded due to minified pattern`);
    return false;
  }

  // Add more specific checks if needed, e.g., very large files

  return true;
}
