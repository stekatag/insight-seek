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
});
