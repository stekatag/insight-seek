import { db } from "@/server/db";
import type { Config } from "@netlify/functions";
import { z } from "zod";

import { aiSummarizeCommit } from "@/lib/gemini";
import { createRobustOctokit, verifyGitHubToken } from "@/lib/github-api";

// Define the request body schema
const bodyParser = z.object({
  githubUrl: z.string(),
  projectId: z.string(),
  githubToken: z.string().optional(),
  isProjectCreation: z.boolean().optional(),
});

/**
 * Extracts owner and repo from a GitHub URL
 */
function parseGitHubUrl(githubUrl: string): { owner: string; repo: string } {
  const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/i;
  const match = githubUrl.match(urlPattern);

  if (!match) {
    throw new Error("Invalid GitHub URL format");
  }

  const owner = match[1];
  let repo = match[2];

  // @ts-expect-error
  repo = repo.replace(/\.git$/, "").replace(/\/$/, "");

  // @ts-expect-error
  return { owner, repo };
}

type CommitData = {
  commitHash: string;
  commitMessage: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commitDate: string;
};

/**
 * Gets commit data from GitHub repository
 */
async function getCommitHashes(
  githubUrl: string,
  githubToken?: string,
): Promise<CommitData[]> {
  try {
    const { owner, repo } = parseGitHubUrl(githubUrl);

    // Create octokit with the GitHub token if available
    const octokit = createRobustOctokit(githubToken);

    // Try to get the repository first to test access
    try {
      await octokit.rest.repos.get({
        owner,
        repo,
      });
      console.log(
        `Successfully verified access to repository ${owner}/${repo}`,
      );
    } catch (repoError: any) {
      console.error(`Error accessing repository ${owner}/${repo}:`, repoError);
      if (repoError.status === 404) {
        throw new Error(
          `Repository not found or no access to ${owner}/${repo}. For private repositories, ensure GitHub App is installed.`,
        );
      }
      throw repoError;
    }

    // Now fetch the commits
    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 15, // Limit to 15 most recent commits
    });

    // Sort commits by date (most recent first)
    const sortedCommits = data.sort(
      (a, b) =>
        new Date(b.commit.author?.date || 0).getTime() -
        new Date(a.commit.author?.date || 0).getTime(),
    );

    return sortedCommits.map((commit) => ({
      commitHash: commit.sha,
      commitMessage: commit.commit.message || "",
      commitAuthorName:
        commit.commit.author?.name || commit.author?.login || "Unknown",
      commitAuthorAvatar:
        commit.author?.avatar_url ||
        "https://avatars.githubusercontent.com/u/0",
      commitDate: commit.commit.author?.date || new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Error fetching commits:", error);
    throw new Error(
      `Failed to fetch commits: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Process a single commit to generate a summary
 */
async function processSingleCommit(
  commitHash: string,
  projectId: string,
  githubUrl: string,
  githubToken?: string,
  isProjectCreation = false, // New parameter to indicate if this is during project creation
) {
  try {
    // Parse GitHub URL to get owner and repo
    const { owner, repo } = parseGitHubUrl(githubUrl);

    // Use the robust Octokit implementation
    const octokit = createRobustOctokit(githubToken);

    // Get the commit diff
    try {
      const { data } = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: commitHash,
        mediaType: { format: "diff" },
      });

      const diffData = data as unknown as string;

      // Extract modified files from the diff
      const modifiedFiles = extractModifiedFiles(diffData);
      console.log(
        `Extracted ${modifiedFiles.length} modified files from commit ${commitHash}`,
      );

      // Generate summary using AI
      const summary = await aiSummarizeCommit(diffData);

      // For project creation, we don't need to reindex since files are already indexed
      const needsReindex = isProjectCreation ? false : modifiedFiles.length > 0;

      // Update commit with summary and modified files in database
      await db.commit.updateMany({
        where: { projectId, commitHash },
        data: {
          summary: summary || "No significant changes detected",
          modifiedFiles,
          needsReindex: needsReindex, // Don't mark for reindexing if this is during project creation
        },
      });

      console.log(
        `Successfully processed commit ${commitHash} with ${modifiedFiles.length} modified files. Reindexing needed: ${needsReindex}`,
      );
      return summary;
    } catch (commitError: any) {
      console.error(`Error fetching commit ${commitHash}:`, commitError);
      if (commitError.status === 404) {
        throw new Error(
          `Commit ${commitHash} not found in repository ${owner}/${repo}`,
        );
      }
      throw commitError;
    }
  } catch (error) {
    console.error(`Error processing commit ${commitHash}:`, error);

    // Update with error message if summarization fails
    await db.commit.updateMany({
      where: { projectId, commitHash },
      data: { summary: "Failed to generate summary" },
    });

    throw error;
  }
}

// Helper function to extract modified files from git diff
function extractModifiedFiles(diffContent: string): string[] {
  if (!diffContent || typeof diffContent !== "string") {
    console.error("Invalid diff content:", diffContent);
    return [];
  }

  console.log("Analyzing diff content for file changes...");

  const modifiedFiles = new Set<string>();

  // More robust regex for file detection
  // This regex captures file paths from multiple diff formats
  const diffFileRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
  const fileHeaderRegex = /^(\+\+\+|---) [ab]\/(.+?)$/gm;

  // Check for files using the standard git diff format
  let match;
  while ((match = diffFileRegex.exec(diffContent)) !== null) {
    if (match[2]) {
      const path = match[2].trim();
      console.log(`Found modified file (diff format): ${path}`);

      if (shouldProcessFile(path)) {
        modifiedFiles.add(path);
        console.log(`Added file to reindex: ${path}`);
      } else {
        console.log(`Skipped file (filtered): ${path}`);
      }
    }
  }

  // Also check for files using the unified diff format
  while ((match = fileHeaderRegex.exec(diffContent)) !== null) {
    if (match[2]) {
      const path = match[2].trim();
      console.log(`Found modified file (header format): ${path}`);

      if (shouldProcessFile(path)) {
        modifiedFiles.add(path);
        console.log(`Added file to reindex: ${path}`);
      } else {
        console.log(`Skipped file (filtered): ${path}`);
      }
    }
  }

  // Manual check - this is for debugging
  if (modifiedFiles.size === 0) {
    console.log(
      "No files detected with standard patterns, checking raw diff...",
    );

    // Log the first 500 chars of diff for debugging
    console.log("Diff content sample:", diffContent.substring(0, 500) + "...");

    // Try to identify any paths that look like file paths
    const possibleFilePaths = diffContent.match(
      /[a-zA-Z0-9_\-/.]+\.[a-zA-Z0-9]{1,5}/g,
    );
    if (possibleFilePaths) {
      console.log("Possible file paths found:", possibleFilePaths);
    }
  }

  const files = Array.from(modifiedFiles);
  console.log(`Total files to reindex: ${files.length}`);
  return files;
}

// Helper to determine if a file should be processed
function shouldProcessFile(filePath: string): boolean {
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
    "yarn.lock",
    ".gitignore",
    ".env",
    "node_modules/",
    "dist/",
    "build/",
    ".next/",
    "out/",
  ];

  // Check excluded extensions
  if (excludedExtensions.some((ext) => filePath.toLowerCase().endsWith(ext))) {
    console.log(`File ${filePath} excluded due to extension`);
    return false;
  }

  // Check excluded patterns
  if (excludedFilePatterns.some((pattern) => filePath.includes(pattern))) {
    console.log(`File ${filePath} excluded due to pattern match`);
    return false;
  }

  // Use the same criteria as in github-loader.ts
  if (
    filePath.endsWith(".min.js") ||
    filePath.endsWith(".min.css") ||
    filePath.includes("node_modules/") ||
    filePath.includes("dist/") ||
    filePath.includes("build/") ||
    filePath.includes(".next/")
  ) {
    console.log(`File ${filePath} excluded due to standard filters`);
    return false;
  }

  console.log(`File ${filePath} passed all filters`);
  return true;
}

/**
 * Main background function to process commits
 */
export default async (request: Request) => {
  console.log("🔄 process-commits-background function invoked");

  try {
    // Parse request body
    const body = await request.json();
    console.log("📥 Received request body:", JSON.stringify(body));

    const { githubUrl, projectId, githubToken } = bodyParser.parse(body);

    // New parameter to check if this is during project creation
    const isProjectCreation = body.isProjectCreation === true;

    console.log(
      `Processing commits for project ${projectId}${isProjectCreation ? " (during project creation)" : ""}`,
    );

    // If we don't have a GitHub token but this is a private repo, we need to fetch it from the database
    let effectiveGithubToken = githubToken;

    // Return a quick response to the client
    const response = new Response(
      JSON.stringify({
        status: "processing",
        projectId,
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );

    // Send response before continuing with long-running operations
    await response.clone().text();
    console.log(
      "✅ Sent initial 202 response, continuing with background processing",
    );

    try {
      // If we don't have a token yet, try to get the project owner's token
      if (!effectiveGithubToken) {
        try {
          // Get the project to find its owner
          const project = await db.project.findUnique({
            where: { id: projectId },
            select: {
              userToProjects: {
                select: { userId: true },
                take: 1,
              },
            },
          });

          const projectOwner = project?.userToProjects[0]?.userId;

          if (projectOwner) {
            // Verify the token for the owner
            const tokenVerification = await verifyGitHubToken(projectOwner);

            if (tokenVerification.isValid) {
              // Fetch the latest token again (it might have refreshed)
              const userToken = await db.userGitHubToken.findUnique({
                where: { userId: projectOwner },
                select: { token: true },
              });

              if (userToken?.token) {
                console.log(
                  "Verified GitHub token for project owner, using it for commit processing",
                );
                effectiveGithubToken = userToken.token;
              } else {
                console.warn(
                  "Token verified but couldn't retrieve it from database. Proceeding without token.",
                );
              }
            } else {
              console.warn(
                `Token verification failed for user ${projectOwner}: ${tokenVerification.error}`,
              );
            }
          }
        } catch (tokenError) {
          console.error(
            "Error fetching or verifying GitHub token:",
            tokenError,
          );
        }
      }

      // 1. Fetch commits from GitHub - use the token if we have one
      const commits = await getCommitHashes(githubUrl, effectiveGithubToken);
      console.log(`Fetched ${commits.length} commits from GitHub`);

      // 2. Filter out commits that are already in the database
      const existingCommits = await db.commit.findMany({
        where: {
          projectId,
          commitHash: { in: commits.map((c) => c.commitHash) },
        },
        select: { commitHash: true },
      });

      const existingHashSet = new Set(existingCommits.map((c) => c.commitHash));
      const newCommits = commits.filter(
        (c) => !existingHashSet.has(c.commitHash),
      );

      console.log(`Found ${newCommits.length} new commits to process`);

      if (newCommits.length === 0) {
        console.log("No new commits to process");
        return response;
      }

      // 3. Insert commits with placeholder summaries
      await db.commit.createMany({
        data: newCommits.map((commit) => ({
          projectId,
          commitHash: commit.commitHash,
          commitAuthorName: commit.commitAuthorName,
          commitDate: new Date(commit.commitDate),
          commitMessage: commit.commitMessage,
          commitAuthorAvatar: commit.commitAuthorAvatar,
          summary: "Analyzing commit...", // Placeholder message
        })),
        skipDuplicates: true,
      });

      // 4. Process each commit one by one
      for (const commit of newCommits) {
        try {
          console.log(`Processing commit ${commit.commitHash}`);
          await processSingleCommit(
            commit.commitHash,
            projectId,
            githubUrl,
            effectiveGithubToken,
            isProjectCreation,
          );
        } catch (err) {
          console.error(`Failed to process commit ${commit.commitHash}:`, err);
          // Continue with other commits
        }
      }

      console.log(`Successfully processed ${newCommits.length} commits`);
    } catch (error) {
      console.error("Error processing commits:", error);
    }

    return response;
  } catch (error) {
    console.error("Process commits error:", error);

    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

// Configure the function path
export const config: Config = {
  path: "/api/process-commits",
};
