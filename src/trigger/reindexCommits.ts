import { db } from "@/server/db";
import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import {
  createRobustOctokit,
  extractFilesFromDiff,
  parseGitHubUrl,
  shouldProcessFile,
} from "@/lib/github-api";
import { getInstallationToken } from "@/lib/github-app";
import { indexFilesFromCommits } from "@/lib/github-loader";

// Define the schema for the event payload
const ReindexPayloadSchema = z.object({
  projectId: z.string(),
  githubUrl: z.string(),
  commitIds: z.array(z.string()),
  userId: z.string(),
});

// Define the Trigger.dev task using schemaTask
export const reindexCommitsTask = schemaTask({
  id: "reindex-commits",
  schema: ReindexPayloadSchema,
  run: async (payload, { ctx }) => {
    const { projectId, githubUrl, commitIds, userId } = payload;

    logger.info("🔄 Reindex Commits Task started.", {
      projectId,
      commitCount: commitIds.length,
      runId: ctx.run.id,
    });

    try {
      // 1. Get GitHub Token
      const githubToken = await getInstallationToken(userId);
      logger.info(
        `GitHub token ${githubToken ? "obtained" : "not available/needed"}.`,
        { projectId },
      );

      // 2. Get Project Details
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { branch: true },
      });
      const branch = project?.branch || "main";
      logger.info(`Using branch: ${branch}`, { projectId });

      // 3. Parse GitHub URL & create Octokit
      const { owner, repo } = parseGitHubUrl(githubUrl);
      const octokit = createRobustOctokit(githubToken ?? undefined);

      // 4. Fetch Commits to Reindex
      const commits = await db.commit.findMany({
        where: {
          id: { in: commitIds },
          projectId: projectId,
        },
        orderBy: {
          commitDate: "asc",
        },
        select: {
          id: true,
          commitHash: true,
          modifiedFiles: true,
          commitDate: true,
        },
      });
      logger.info(`Found ${commits.length} commits in DB matching IDs.`, {
        projectId,
      });

      // 5. Process each commit sequentially
      let totalFilesReindexed = 0;
      for (const commit of commits) {
        logger.info(`Processing commit ${commit.commitHash}`, { projectId });

        let filesToProcess: string[] = commit.modifiedFiles || [];
        let diffFetchError = false; // Flag to track if diff fetch failed

        // Fetch diff if modifiedFiles are missing
        if (!filesToProcess || filesToProcess.length === 0) {
          logger.info(`Fetching diff for commit ${commit.commitHash}`, {
            projectId,
          });
          try {
            const { data } = await octokit.rest.repos.getCommit({
              owner,
              repo,
              ref: commit.commitHash,
              mediaType: { format: "diff" },
            });
            const diffData = data as unknown as string;
            filesToProcess = extractFilesFromDiff(diffData);
            logger.info(
              `Extracted ${filesToProcess.length} files from fetched diff`,
              { projectId, commitHash: commit.commitHash },
            );
            // Store the extracted files back to the commit
            await db.commit.update({
              where: { id: commit.id },
              data: { modifiedFiles: filesToProcess },
            });
          } catch (error) {
            logger.error(
              `Error fetching diff for commit ${commit.commitHash}`,
              {
                projectId,
                error: error instanceof Error ? error.message : String(error),
              },
            );
            diffFetchError = true; // Set flag if diff fetch fails
          }
        } else {
          logger.info(
            `Using ${filesToProcess.length} stored modified files for commit ${commit.commitHash}`,
            { projectId },
          );
        }

        // If diff fetch failed, skip indexing and mark as done (or potentially leave needsReindex=true?)
        // For now, mark as done and skip indexing for this commit.
        if (diffFetchError) {
          logger.warn(
            `Skipping indexing for commit ${commit.commitHash} due to diff fetch error. Marking as reindexed.`,
            { projectId },
          );
          await db.commit.update({
            where: { id: commit.id },
            data: { needsReindex: false }, // Mark as false even on error for simplicity now
          });
          continue; // Move to the next commit
        }

        // Skip if no files found or extracted after potential fetch
        if (filesToProcess.length === 0) {
          logger.info(
            `No files to reindex for commit ${commit.commitHash}, marking as done.`,
            { projectId },
          );
          await db.commit.update({
            where: { id: commit.id },
            data: { needsReindex: false },
          });
          continue; // Move to the next commit
        }

        // Filter files
        const filteredFiles = filesToProcess.filter(shouldProcessFile);
        logger.info(
          `Filtered down to ${filteredFiles.length} files for commit ${commit.commitHash}`,
          { projectId },
        );

        if (filteredFiles.length > 0) {
          try {
            await indexFilesFromCommits(
              projectId,
              githubUrl,
              branch,
              filteredFiles,
              githubToken ?? undefined,
            );
            totalFilesReindexed += filteredFiles.length;
            logger.info(
              `Successfully submitted ${filteredFiles.length} files for indexing from commit ${commit.commitHash}`,
              { projectId },
            );
          } catch (indexingError) {
            logger.error(
              `Error during file indexing for commit ${commit.commitHash}`,
              {
                projectId,
                error:
                  indexingError instanceof Error
                    ? indexingError.message
                    : String(indexingError),
              },
            );
            // Log indexing error but continue to mark commit as processed
          }
        } else {
          logger.info(
            `No processable files after filtering for commit ${commit.commitHash}`,
            { projectId },
          );
        }

        // Mark commit as reindexed (happens even if indexing had issues)
        await db.commit.update({
          where: { id: commit.id },
          data: { needsReindex: false },
        });
        logger.info(`Marked commit ${commit.commitHash} as reindexed.`, {
          projectId,
        });
      } // End for loop commits

      logger.info(
        `✅ Successfully completed reindexing task for project ${projectId}. Total files processed: ${totalFilesReindexed}.`,
        { projectId, runId: ctx.run.id },
      );
      return {
        status: "success",
        processedCommitCount: commits.length,
        totalFilesReindexed,
      };
    } catch (error) {
      logger.error("❌ Error during reindex commits task", {
        projectId,
        runId: ctx.run.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  },
});
