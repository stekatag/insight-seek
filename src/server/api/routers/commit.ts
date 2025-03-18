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

      return commits;
    }),

  // Process commits for a project
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

      try {
        // This is the most common pattern for axios that works in both server and client contexts
        console.log("Calling commits processing endpoint");

        // For server-side execution, we need absolute URLs
        const baseUrl =
          process.env.NODE_ENV === "development"
            ? "http://localhost:8888"
            : "https://insightseek.vip";

        // Use a simple axios.post() call with absolute URL
        await axios.post(
          `${baseUrl}/.netlify/functions/process-commits-background`,
          {
            githubUrl,
            projectId,
            githubToken,
          },
        );

        return {
          success: true,
          message: "Commits processing started",
        };
      } catch (error) {
        console.error("Failed to process commits:", error);
        throw new Error(
          `Failed to process commits: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }),
});
