import { db } from "@/server/db";
import type { Config } from "@netlify/functions";
import { z } from "zod";

import { createRobustOctokit } from "@/lib/github-api";
import { indexFilesFromCommits } from "@/lib/github-loader";

// Define the request body schema
const bodyParser = z.object({
  projectId: z.string(),
  githubUrl: z.string(),
  commitIds: z.array(z.string()),
  githubToken: z.string().optional(),
});

export default async (request: Request) => {
  console.log("🔄 reindex-commits-background function invoked");

  try {
    // Parse request body
    const body = await request.json();
    console.log(
      "📥 Received reindex request body:",
      JSON.stringify({
        ...body,
        githubToken: body.githubToken ? "[REDACTED]" : undefined,
      }),
    );

    const { projectId, githubUrl, commitIds, githubToken } =
      bodyParser.parse(body);

    console.log(
      `🚀 Processing reindexing for ${commitIds.length} commits in project ${projectId}`,
    );

    // Return a quick response to the client
    const response = new Response(
      JSON.stringify({
        status: "processing",
        projectId,
        commitCount: commitIds.length,
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );

    // Send response before continuing with long-running operations
    await response.clone().text();
    console.log(
      "✅ Sent initial 202 response, continuing with background reindexing",
    );

    try {
      // Get project branch
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { branch: true },
      });

      // Default to main branch if not specified
      const branch: string = project?.branch || "main";

      // Parse GitHub URL to get owner and repo
      const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/i;
      const match = githubUrl.match(urlPattern);

      if (!match || !match[1] || !match[2]) {
        throw new Error("Invalid GitHub URL format");
      }

      const owner: string = match[1];
      let repo: string = match[2].replace(/\.git$/, "").replace(/\/$/, "");

      if (!repo) {
        throw new Error("Could not extract repository name from GitHub URL");
      }

      // Create octokit instance
      const octokit = createRobustOctokit(githubToken);

      // Get commit details in chronological order
      const commits = await db.commit.findMany({
        where: {
          id: { in: commitIds },
          projectId,
        },
        orderBy: {
          commitDate: "asc", // Process oldest first
        },
      });

      // Process each commit in order
      for (const commit of commits) {
        try {
          console.log(`Processing files from commit ${commit.commitHash}`);

          // Get all modified files
          let filesToProcess: string[] = [];

          // If commit has stored modified files, use them
          if (commit.modifiedFiles && commit.modifiedFiles.length > 0) {
            filesToProcess = commit.modifiedFiles;
            console.log(
              `Using ${filesToProcess.length} files from stored modifiedFiles`,
            );
          } else {
            // If not, fetch the diff and extract files
            console.log(
              `No stored modified files, fetching diff for commit ${commit.commitHash}`,
            );
            try {
              // Get the commit diff
              const { data } = await octokit.rest.repos.getCommit({
                owner,
                repo,
                ref: commit.commitHash,
                mediaType: { format: "diff" },
              });

              const diffData = data as unknown as string;

              // Extract files from the diff
              filesToProcess = extractFilesFromDiff(diffData);
              console.log(
                `Extracted ${filesToProcess.length} files from fetched diff`,
              );

              // Store the modified files for future use
              await db.commit.update({
                where: { id: commit.id },
                data: {
                  modifiedFiles: filesToProcess,
                },
              });
            } catch (error) {
              console.error(
                `Error fetching diff for commit ${commit.commitHash}:`,
                error,
              );
            }
          }

          // Skip if no files to reindex
          if (filesToProcess.length === 0) {
            console.log(`No files to reindex for commit ${commit.commitHash}`);
            // Mark as reindexed anyway since there's nothing to do
            await db.commit.update({
              where: { id: commit.id },
              data: { needsReindex: false },
            });
            continue;
          }

          // Filter files to only include those we should process
          const filteredFiles = filesToProcess.filter((file) =>
            shouldProcessFile(file),
          );
          console.log(
            `Will reindex ${filteredFiles.length} out of ${filesToProcess.length} files`,
          );

          // Reindex filtered files for this commit
          await indexFilesFromCommits(
            projectId,
            githubUrl,
            branch,
            filteredFiles,
            githubToken,
          );

          // Mark this commit as reindexed
          await db.commit.update({
            where: { id: commit.id },
            data: { needsReindex: false },
          });

          console.log(
            `Successfully reindexed ${filteredFiles.length} files from commit ${commit.commitHash}`,
          );
        } catch (err) {
          console.error(`Failed to reindex commit ${commit.commitHash}:`, err);
          // Continue with other commits
        }
      }

      console.log(`Successfully completed reindexing for project ${projectId}`);
    } catch (error) {
      console.error("Error during reindexing process:", error);
    }

    return response;
  } catch (error) {
    console.error("Reindex commits error:", error);

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

// Helper function to extract files from git diff
function extractFilesFromDiff(diffContent: string): string[] {
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
    console.log("Diff content sample:", diffContent.substring(0, 500) + "...");
  }

  const files = Array.from(modifiedFiles);
  console.log(`Total modified files from diff: ${files.length}`);
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

  return true;
}

// Configure the function path
export const config: Config = {
  path: "/api/reindex-commits",
};
