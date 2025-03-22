import axios from "axios";
import { z } from "zod";

import { createTRPCRouter, protectedProdecure } from "../trpc";

export const commitRouter = createTRPCRouter({
  // Get commits for a project
  getCommits: protectedProdecure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Fetch commits from database
      const commits = await ctx.db.commit.findMany({
        where: { projectId: input.projectId },
        orderBy: { commitDate: "desc" },
      });

      // Get count of commits that need reindexing
      const reindexCount = commits.filter(
        (commit) => commit.needsReindex,
      ).length;

      // Calculate the total number of modified files across commits that need reindexing
      const modifiedFilesCount = commits
        .filter((commit) => commit.needsReindex)
        .reduce((acc, commit) => acc + (commit.modifiedFiles?.length || 0), 0);

      return {
        commits,
        reindexMetadata: {
          commitCount: reindexCount,
          fileCount: modifiedFilesCount,
        },
      };
    }),

  // Process commits for a project - this mutation now just returns the data needed for client-side processing
  processCommits: protectedProdecure
    .input(
      z.object({
        projectId: z.string(),
        githubUrl: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, githubUrl } = input;

      // Get GitHub token if available
      let githubToken = undefined;
      try {
        const project = await ctx.db.project.findFirst({
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
          const userToken = await ctx.db.userGitHubToken.findUnique({
            where: { userId: projectOwner },
            select: { token: true },
          });

          if (userToken?.token) {
            githubToken = userToken.token;
          }
        }
      } catch (error) {
        console.error("Error fetching GitHub token:", error);
      }

      // Return the data for client-side processing
      return {
        success: true,
        message: "Commits processing can be started",
        data: {
          projectId,
          githubUrl,
          githubToken,
        },
      };
    }),

  // New mutation to confirm and start reindexing
  confirmReindex: protectedProdecure
    .input(
      z.object({
        projectId: z.string(),
        githubUrl: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, githubUrl } = input;
      const userId = ctx.user.userId!;

      // Get all commits that need reindexing, ordered chronologically
      const commitsToReindex = await ctx.db.commit.findMany({
        where: {
          projectId,
          needsReindex: true,
        },
        orderBy: {
          commitDate: "asc", // Order from oldest to newest
        },
      });

      // Calculate total files to reindex
      const totalFiles = commitsToReindex.reduce(
        (acc, commit) => acc + (commit.modifiedFiles?.length || 0),
        0,
      );

      // Check if user has enough credits (2 per file)
      const creditsNeeded = totalFiles * 2;
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (!user || user.credits < creditsNeeded) {
        throw new Error(
          `Not enough credits. You need ${creditsNeeded} credits to reindex ${totalFiles} files.`,
        );
      }

      // Deduct credits
      await ctx.db.user.update({
        where: { id: userId },
        data: { credits: { decrement: creditsNeeded } },
      });

      // Record transaction
      await ctx.db.stripeTransaction.create({
        data: {
          userId,
          credits: -creditsNeeded,
        },
      });

      // Return the data needed for the background reindexing process
      return {
        success: true,
        message: `Started reindexing ${commitsToReindex.length} commits with ${totalFiles} modified files`,
        data: {
          projectId,
          githubUrl,
          commitIds: commitsToReindex.map((c) => c.id),
          fileCount: totalFiles,
          creditsUsed: creditsNeeded,
        },
      };
    }),

  // Check reindex status
  getReindexStatus: protectedProdecure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const commitsPendingReindex = await ctx.db.commit.count({
        where: {
          projectId: input.projectId,
          needsReindex: true,
        },
      });

      const modifiedFileCount = await ctx.db.commit
        .findMany({
          where: {
            projectId: input.projectId,
            needsReindex: true,
          },
          select: {
            modifiedFiles: true,
          },
        })
        .then((commits) =>
          commits.reduce(
            (acc, commit) => acc + (commit.modifiedFiles?.length || 0),
            0,
          ),
        );

      return {
        pendingCount: commitsPendingReindex,
        fileCount: modifiedFileCount,
      };
    }),
});
