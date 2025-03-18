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
        // Continue without token if we can't get it
      }

      try {
        // Determine the proper URL for the API
        // Using the complete path for axios is crucial for both server & client environments
        const apiUrl =
          process.env.NODE_ENV === "development"
            ? "http://localhost:8888/api/process-commits"
            : "https://insightseek.vip/api/process-commits";

        console.log(`Calling commits processing endpoint at: ${apiUrl}`);

        // Call the background function to process commits with correct URL
        const response = await axios.post(apiUrl, {
          githubUrl,
          projectId,
          githubToken,
        });

        return {
          success: true,
          message: "Commits processing started",
        };
      } catch (error) {
        console.error("Failed to process commits:", error);
        throw new Error("Failed to process commits");
      }
    }),
});
