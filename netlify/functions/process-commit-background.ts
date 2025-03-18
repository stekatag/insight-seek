import { db } from "@/server/db";
import type { Config } from "@netlify/functions";
import { z } from "zod";

import { aiSummarizeCommit } from "@/lib/gemini";
import { createRobustOctokit } from "@/lib/github-api";

// Define the request body schema
const bodyParser = z.object({
  commitHash: z.string(),
  projectId: z.string(),
  githubUrl: z.string(),
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

  // Remove .git if present and any trailing slashes
  // @ts-expect-error
  repo = repo.replace(/\.git$/, "").replace(/\/$/, "");

  // @ts-expect-error
  return { owner, repo };
}

/**
 * Netlify background function to process a single commit and generate a summary
 */
export default async (request: Request) => {
  console.log("🔄 process-commit-background function invoked");

  try {
    // Parse request body
    const body = await request.json();
    console.log("📥 Received request body:", JSON.stringify(body));

    const { commitHash, projectId, githubUrl, githubToken } =
      bodyParser.parse(body);

    console.log(
      `🚀 Processing commit summary for ${commitHash} in project ${projectId}`,
    );

    // Return a quick response
    const response = new Response(
      JSON.stringify({
        status: "processing",
        commitHash,
        projectId,
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );

    // Send response before continuing
    await response.clone().text();

    console.log(
      "✅ Sent initial 202 response, continuing with background processing",
    );

    try {
      // Parse GitHub URL to get owner and repo
      const { owner, repo } = parseGitHubUrl(githubUrl);

      // Create an abort controller to handle timeouts
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 30000); // 30 seconds timeout

      try {
        // Use the robust Octokit implementation
        const octokit = createRobustOctokit(
          githubToken,
          abortController.signal,
        );

        console.log(
          `Fetching commit diff for ${commitHash} from ${owner}/${repo}`,
        );

        // Get the commit diff
        const { data } = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: commitHash,
          mediaType: { format: "diff" },
        });

        const diffData = data as unknown as string;

        // Generate summary using AI
        console.log(`Generating AI summary for commit ${commitHash}`);
        const summary = await aiSummarizeCommit(diffData);

        // Update commit with summary in database
        console.log(`Updating database with summary for commit ${commitHash}`);
        await db.commit.updateMany({
          where: { projectId, commitHash },
          data: { summary: summary || "No significant changes detected" },
        });

        console.log(`Successfully processed commit ${commitHash}`);
      } catch (error) {
        console.error(`Error processing commit ${commitHash}:`, error);

        // Update with error message if summarization fails
        await db.commit.updateMany({
          where: { projectId, commitHash },
          data: { summary: "Failed to generate summary" },
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.error(`Error processing commit ${commitHash}:`, error);

      // Update with error message
      await db.commit.updateMany({
        where: { projectId, commitHash },
        data: { summary: "Error processing commit" },
      });
    }

    return response;
  } catch (error) {
    console.error("Process commit error:", error);

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
  path: "/api/process-commit",
};
