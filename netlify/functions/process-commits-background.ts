import { db } from "@/server/db";
import type { Config } from "@netlify/functions";
import { z } from "zod";

import { aiSummarizeCommit } from "@/lib/gemini";
import { createRobustOctokit } from "@/lib/github-api";

// Define the request body schema
const bodyParser = z.object({
  githubUrl: z.string(),
  projectId: z.string(),
  githubToken: z.string().optional(),
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
    const octokit = createRobustOctokit(githubToken);

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
) {
  try {
    // Parse GitHub URL to get owner and repo
    const { owner, repo } = parseGitHubUrl(githubUrl);

    // Use the robust Octokit implementation
    const octokit = createRobustOctokit(githubToken);

    // Get the commit diff
    const { data } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: commitHash,
      mediaType: { format: "diff" },
    });

    const diffData = data as unknown as string;

    // Generate summary using AI
    const summary = await aiSummarizeCommit(diffData);

    // Update commit with summary in database
    await db.commit.updateMany({
      where: { projectId, commitHash },
      data: { summary: summary || "No significant changes detected" },
    });

    console.log(`Successfully processed commit ${commitHash}`);
    return summary;
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

    console.log(`🚀 Processing commits for project ${projectId}`);

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
      // 1. Fetch commits from GitHub
      const commits = await getCommitHashes(githubUrl, githubToken);
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
            githubToken,
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
