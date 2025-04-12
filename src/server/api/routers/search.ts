import { z } from "zod";

import { createTRPCRouter, protectedProdecure } from "../trpc";

export const searchRouter = createTRPCRouter({
  search: protectedProdecure
    .input(
      z.object({
        query: z.string().min(2).max(100),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { query, limit } = input;
      const userId = ctx.user.userId!;

      // Normalize query for search
      const searchQuery = `%${query.toLowerCase()}%`;

      // Get user accessible projects
      const accessibleProjects = await ctx.db.project.findMany({
        where: {
          userToProjects: {
            some: { userId },
          },
          deletedAt: null,
        },
        select: { id: true },
      });

      const projectIds = accessibleProjects.map((p) => p.id);

      if (projectIds.length === 0) {
        return {
          projects: [],
          questions: [],
          meetings: [],
          commits: [],
        };
      }

      // Search projects
      const projects = await ctx.db.project.findMany({
        where: {
          id: { in: projectIds },
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { githubUrl: { contains: query, mode: "insensitive" } },
          ],
        },
        take: limit,
        orderBy: { updatedAt: "desc" },
      });

      // Search questions (both project-related and meeting-related)
      const questions = await ctx.db.question.findMany({
        where: {
          // Filter by user ID for all their questions
          userId: userId,
          // Remove projectId filter to include meeting questions
          // projectId: { in: projectIds },
          OR: [
            { question: { contains: query, mode: "insensitive" } },
            { answer: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          // Keep project for context (will be null for meeting questions)
          project: { select: { name: true } },
          // Include chatId and meetingId (if applicable) for linking
          chat: { select: { id: true, meetingId: true } },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
      });

      // Search meetings - Now searches user's completed meetings
      const meetings = await ctx.db.meeting.findMany({
        where: {
          // Filter by user ID
          userId: userId,
          // Filter by status
          status: "COMPLETED",
          OR: [
            // Search meeting name
            { name: { contains: query, mode: "insensitive" } },
            // Also search within related issues
            {
              issues: {
                some: {
                  OR: [
                    { headline: { contains: query, mode: "insensitive" } },
                    { summary: { contains: query, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        },
        include: {
          issues: {
            where: {
              OR: [
                { headline: { contains: query, mode: "insensitive" } },
                { summary: { contains: query, mode: "insensitive" } },
              ],
            },
            take: 1, // Limit to one matching issue for preview
          },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
      });

      // Search commits - include commitHash and project githubUrl
      const commits = await ctx.db.commit.findMany({
        where: {
          projectId: { in: projectIds },
          OR: [
            { commitMessage: { contains: query, mode: "insensitive" } },
            { summary: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          project: {
            select: {
              name: true,
              githubUrl: true,
            },
          },
        },
        take: limit,
        orderBy: { commitDate: "desc" },
      });

      return {
        projects,
        questions,
        meetings,
        commits,
      };
    }),
});
