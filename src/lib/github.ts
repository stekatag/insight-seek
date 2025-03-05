// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { db } from "@/server/db";
import axios from "axios";
import { Octokit } from "octokit";
import { aiSummarizeCommit } from "./gemini";

/**
 * Creates an authenticated Octokit instance
 * @param userToken Optional user-provided token for private repositories
 */
export function createOctokit(userToken?: string) {
  // Use user-provided token if available, otherwise fall back to application token
  const token = userToken || process.env.GITHUB_TOKEN;
  return new Octokit({ auth: token });
}

type CommitData = {
  commitHash: string;
  commitMessage: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commitDate: string;
};

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
  repo = repo.replace(/\.git$/, "").replace(/\/$/, "");

  return { owner, repo };
}

/**
 * Gets commit data from GitHub repository
 */
export async function getCommitHashes(
  githubUrl: string,
  githubToken?: string,
): Promise<CommitData[]> {
  try {
    const { owner, repo } = parseGitHubUrl(githubUrl);
    const octokit = createOctokit(githubToken);

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
 * Pulls commits for a project and processes them
 */
export async function pullCommits(projectId: string) {
  try {
    // Get project details
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        githubUrl: true,
        userToProjects: {
          select: {
            userId: true,
          },
          take: 1,
        },
      },
    });

    if (!project || !project.githubUrl) {
      throw new Error("Project not found or missing GitHub URL");
    }

    // Get project owner's GitHub token if available
    const projectOwner = project.userToProjects[0]?.userId;
    let githubToken: string | undefined = undefined;

    if (projectOwner) {
      // You might have a table to store user GitHub tokens
      // This is just a placeholder for the concept
      const userToken = await db.userGitHubToken
        .findUnique({
          where: { userId: projectOwner },
          select: { token: true },
        })
        .catch(() => null);

      githubToken = userToken?.token;
    }

    // Fetch commits from GitHub
    const commits = await getCommitHashes(project.githubUrl, githubToken);

    // Filter out commits that are already in the database
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

    if (newCommits.length === 0) {
      console.log("No new commits to process");
      return { added: 0, total: existingCommits.length };
    }

    // Insert commits with a placeholder summary
    const placeholderSummary = "Analyzing commit...";

    await db.commit.createMany({
      data: newCommits.map((commit) => ({
        projectId,
        commitHash: commit.commitHash,
        commitAuthorName: commit.commitAuthorName,
        commitDate: new Date(commit.commitDate),
        commitMessage: commit.commitMessage,
        commitAuthorAvatar: commit.commitAuthorAvatar,
        summary: placeholderSummary, // Use a placeholder initially
      })),
      skipDuplicates: true,
    });

    // Process summaries asynchronously
    processSummariesAsync(
      project.githubUrl,
      projectId,
      newCommits,
      githubToken,
    ).catch((err) => console.error("Error processing summaries:", err));

    return {
      added: newCommits.length,
      total: existingCommits.length + newCommits.length,
    };
  } catch (error) {
    console.error("Error pulling commits:", error);
    return { error: String(error), added: 0, total: 0 };
  }
}

/**
 * Processes commit summaries asynchronously
 */
async function processSummariesAsync(
  githubUrl: string,
  projectId: string,
  commits: CommitData[],
  githubToken?: string,
) {
  for (const commit of commits) {
    try {
      // Generate summary
      const summary = await summarizeCommit(
        githubUrl,
        commit.commitHash,
        githubToken,
      );

      // Update the commit with the real summary
      await db.commit.updateMany({
        where: { projectId, commitHash: commit.commitHash },
        data: { summary },
      });

      console.log(`Processed summary for commit ${commit.commitHash}`);
    } catch (err) {
      console.error(
        `Failed to process summary for commit ${commit.commitHash}:`,
        err,
      );

      // Update with error message if summarization fails
      await db.commit.updateMany({
        where: { projectId, commitHash: commit.commitHash },
        data: { summary: "Failed to generate summary" },
      });
    }
  }
}

/**
 * Gets the diff for a commit and generates a summary
 */
async function summarizeCommit(
  githubUrl: string,
  commitHash: string,
  githubToken?: string,
) {
  try {
    // Parse GitHub URL to get owner and repo
    const { owner, repo } = parseGitHubUrl(githubUrl);

    let diffData: string;

    // Try to get diff using Octokit for better auth handling
    try {
      const octokit = createOctokit(githubToken);
      const { data } = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: commitHash,
        mediaType: { format: "diff" },
      });

      diffData = data as unknown as string;
    } catch (error) {
      // Fallback to direct URL request if Octokit approach fails
      const { data } = await axios.get(
        `${githubUrl}/commit/${commitHash}.diff`,
        {
          headers: {
            Accept: "application/vnd.github.v3.diff",
            ...(githubToken ? { Authorization: `token ${githubToken}` } : {}),
          },
        },
      );

      diffData = data;
    }

    // Generate summary using AI
    const summary = await aiSummarizeCommit(diffData);
    return summary || "No significant changes detected";
  } catch (error) {
    console.error(`Error summarizing commit ${commitHash}:`, error);
    return "Unable to generate summary";
  }
}
