import { db } from "@/server/db";
import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { aiSummarizeCommit } from "@/lib/gemini";
import {
  createRobustOctokit,
  extractFilesFromDiff,
  parseGitHubUrl,
} from "@/lib/github-api";
import { getInstallationToken } from "@/lib/github-app";

// Define the input schema for the task payload
const processCommitsPayloadSchema = z.object({
  projectId: z.string(),
  githubUrl: z.string().url(),
  userId: z.string(), // Needed to get the installation token
  isProjectCreation: z.boolean().optional().default(false),
});

// Define the Trigger.dev Task
export const processCommitsTask = schemaTask({
  id: "process-commits",
  schema: processCommitsPayloadSchema,
  run: async (payload, { ctx }) => {
    const { projectId, githubUrl, userId, isProjectCreation } = payload;

    logger.info(`🚀 Starting commit processing for project: ${projectId}`, {
      isProjectCreation,
    });

    let githubToken: string | undefined;
    let fetchedCommits = [];
    const processedCommitHashes = new Set<string>();
    const errors: string[] = [];

    try {
      // 1. Get GitHub Token
      const token = await getInstallationToken(userId);
      githubToken = token || undefined;
      logger.info(
        `GitHub token ${githubToken ? "obtained" : "not available/needed"}.`,
      );

      // 2. Get Commit Hashes from GitHub
      const { owner, repo } = parseGitHubUrl(githubUrl);
      const octokit = createRobustOctokit(githubToken);

      logger.info(`Fetching latest commits from ${owner}/${repo}`);
      const { data: githubCommits } = await octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: 15,
      });

      // Sort and map commits
      const sortedCommits = githubCommits.sort(
        (a, b) =>
          new Date(b.commit.author?.date || 0).getTime() -
          new Date(a.commit.author?.date || 0).getTime(),
      );
      fetchedCommits = sortedCommits.map((commit) => ({
        commitHash: commit.sha,
        commitMessage: commit.commit.message || "",
        commitAuthorName:
          commit.commit.author?.name || commit.author?.login || "Unknown",
        commitAuthorAvatar:
          commit.author?.avatar_url ||
          "https://avatars.githubusercontent.com/u/0",
        commitDate: commit.commit.author?.date || new Date().toISOString(),
      }));
      logger.info(`Fetched ${fetchedCommits.length} commits from GitHub.`);

      // 3. Get Existing Commits from DB
      const existingCommits = await db.commit.findMany({
        where: {
          projectId,
          commitHash: { in: fetchedCommits.map((c) => c.commitHash) },
        },
        select: { commitHash: true, summary: true },
      });
      const existingCommitMap = new Map(
        existingCommits.map((c) => [c.commitHash, c]),
      );
      logger.info(`Found ${existingCommitMap.size} existing commits in DB.`);

      // 4. Process Commits
      for (const commitData of fetchedCommits) {
        try {
          const existingCommit = existingCommitMap.get(commitData.commitHash);

          // Create commit record if it doesn't exist
          if (!existingCommit) {
            logger.info(
              `Creating new commit record for ${commitData.commitHash}`,
            );
            await db.commit.create({
              data: {
                projectId,
                ...commitData,
                summary: "Processing...",
              },
            });
          }

          // Check if we need to generate a summary
          const needsSummary = !existingCommit?.summary;

          if (needsSummary) {
            logger.info(
              `Processing summary for commit ${commitData.commitHash}`,
            );
            // Fetch diff
            const { data: commitDetails } = await octokit.rest.repos.getCommit({
              owner,
              repo,
              ref: commitData.commitHash,
              mediaType: { format: "diff" },
            });
            const diffData = commitDetails as unknown as string;
            // Use the imported extractFilesFromDiff
            const modifiedFiles = extractFilesFromDiff(diffData);
            const summary = await aiSummarizeCommit(diffData);
            // NOTE: We intentionally do NOT use shouldProcessFile here for setting needsReindex.
            // We want needsReindex to be true if *any* files were modified in the diff,
            // even if they are files we wouldn't normally *index* (like images or package-lock).
            // The actual filtering happens later during the reindex task itself.
            const needsReindex = !isProjectCreation && modifiedFiles.length > 0;

            await db.commit.update({
              where: {
                projectId_commitHash: {
                  projectId,
                  commitHash: commitData.commitHash,
                },
              },
              data: {
                summary: summary || "No significant changes detected",
                modifiedFiles,
                needsReindex,
              },
            });
            logger.info(
              `Successfully processed commit ${commitData.commitHash}. Reindex: ${needsReindex}`,
            );
            processedCommitHashes.add(commitData.commitHash);
          } else {
            logger.info(
              `Skipping summary processing for existing commit ${commitData.commitHash}`,
            );
            processedCommitHashes.add(commitData.commitHash);
          }
        } catch (commitError) {
          const errorMsg =
            commitError instanceof Error
              ? commitError.message
              : String(commitError);
          logger.error(
            `Failed to process individual commit ${commitData.commitHash}`,
            { error: errorMsg },
          );
          errors.push(`Commit ${commitData.commitHash}: ${errorMsg}`);
          // Update commit with error message if possible (might fail if commit doesn't exist yet)
          try {
            await db.commit.updateMany({
              where: { projectId, commitHash: commitData.commitHash },
              data: { summary: "Failed to generate summary" },
            });
          } catch (updateError) {
            /* Ignore */
          }
        }
      } // End for loop

      logger.info(
        `✅ Commit processing task completed for project: ${projectId}. Processed: ${processedCommitHashes.size}, Errors: ${errors.length}`,
      );
      return {
        status: "success",
        processedCount: processedCommitHashes.size,
        errors,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `❌ Commit processing task failed globally for project: ${projectId}`,
        { error: errorMessage },
      );
      // Note: Individual commit errors are handled above. This catches broader errors (e.g., fetching token, listing commits).
      // We don't update individual commits here, but the task run itself will be marked as failed.
      throw error; // Re-throw to mark the task run as FAILED
    }
  },
});
