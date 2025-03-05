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

      // Search questions
      const questions = await ctx.db.question.findMany({
        where: {
          projectId: { in: projectIds },
          OR: [
            { question: { contains: query, mode: "insensitive" } },
            { answer: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          project: { select: { name: true } },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
      });

      // Search meetings
      const meetings = await ctx.db.meeting.findMany({
        where: {
          projectId: { in: projectIds },
          name: { contains: query, mode: "insensitive" },
        },
        include: {
          project: { select: { name: true } },
          issues: {
            where: {
              OR: [
                { headline: { contains: query, mode: "insensitive" } },
                { summary: { contains: query, mode: "insensitive" } },
              ],
            },
            take: 1,
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
