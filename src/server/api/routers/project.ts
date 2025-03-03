import { z } from "zod";
import { createTRPCRouter, protectedProdecure } from "../trpc";
import { pullCommits } from "@/lib/github";
import { checkCredits, indexGithubRepo } from "@/lib/github-loader";
import { validateGitHubRepo } from "@/lib/github-validator";

export const projectRouter = createTRPCRouter({
  // Add the new validation procedure
  validateGitHubRepo: protectedProdecure
    .input(
      z.object({
        githubUrl: z.string(),
        githubToken: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return await validateGitHubRepo(input.githubUrl, input.githubToken);
    }),

  createProject: protectedProdecure
    .input(
      z.object({
        name: z.string(),
        githubUrl: z.string(),
        githubToken: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First validate the repository
      const validationResult = await validateGitHubRepo(
        input.githubUrl,
        input.githubToken,
      );

      if (!validationResult.isValid) {
        throw new Error(validationResult.error || "Invalid GitHub repository");
      }

      // If repo is private but no token provided
      if (!validationResult.isPublic && !input.githubToken) {
        throw new Error(
          "This repository is private. Please provide a GitHub token.",
        );
      }

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.userId! },
        select: { credits: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const currentCredits = user.credits || 0;
      const fileCount =
        validationResult.fileCount ||
        (await checkCredits(input.githubUrl, input.githubToken));

      if (currentCredits < fileCount) {
        throw Error("Insufficient credits");
      }

      // Create project and index files in a transaction
      const project = await ctx.db.$transaction(async (tx) => {
        // Create the project
        const project = await tx.project.create({
          data: {
            name: input.name,
            githubUrl: input.githubUrl,
            userToProjects: {
              create: {
                userId: ctx.user.userId!,
              },
            },
          },
        });

        // If user provided a token, store it securely for future API calls
        if (input.githubToken) {
          await tx.userGitHubToken.upsert({
            where: { userId: ctx.user.userId! },
            update: { token: input.githubToken },
            create: { userId: ctx.user.userId!, token: input.githubToken },
          });
        }

        // Update user credits
        await tx.user.update({
          where: { id: ctx.user.userId! },
          data: { credits: { decrement: fileCount } },
        });

        return project;
      });

      // These can run in parallel after the transaction
      const indexPromise = indexGithubRepo(
        project.id,
        input.githubUrl,
        input.githubToken,
      );
      const pullCommitsPromise = pullCommits(project.id);

      // Wait for both operations to complete but catch errors
      await Promise.allSettled([indexPromise, pullCommitsPromise]);

      return project;
    }),

  getProjects: protectedProdecure.query(async ({ ctx }) => {
    return await ctx.db.project.findMany({
      where: {
        userToProjects: {
          some: {
            userId: ctx.user.userId!,
          },
        },
        deletedAt: null,
      },
    });
  }),
  getCommits: protectedProdecure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Start commits pull in the background without waiting for it
      pullCommits(input.projectId).catch((err) =>
        console.error(`Background commit pull failed: ${err}`),
      );

      // Immediately return existing commits
      return await ctx.db.commit.findMany({
        where: { projectId: input.projectId },
        orderBy: { commitDate: "desc" },
      });
    }),
  saveAnswer: protectedProdecure
    .input(
      z.object({
        projectId: z.string(),
        question: z.string(),
        answer: z.string(),
        filesReferences: z.any(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.question.create({
        data: {
          answer: input.answer,
          filesReferences: input.filesReferences,
          projectId: input.projectId,
          question: input.question,
          userId: ctx.user.userId!,
        },
      });
    }),
  getAnswers: protectedProdecure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.question.findMany({
        where: { projectId: input.projectId },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      });
    }),
  uploadMeeting: protectedProdecure
    .input(
      z.object({
        projectId: z.string(),
        meetingUrl: z.string(),
        name: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.meeting.create({
        data: {
          meetingUrl: input.meetingUrl,
          projectId: input.projectId,
          name: input.name,
          status: "PROCESSING",
        },
      });
      return meeting;
    }),
  getMeetings: protectedProdecure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.meeting.findMany({
        where: { projectId: input.projectId },
        include: { issues: true },
      });
    }),
  deleteMeeting: protectedProdecure
    .input(z.object({ meetingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.meeting.delete({ where: { id: input.meetingId } });
    }),
  getMeetingById: protectedProdecure
    .input(z.object({ meetingId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.meeting.findUnique({
        where: { id: input.meetingId },
        include: { issues: true },
      });
    }),
  archiveProject: protectedProdecure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.project.update({
        where: { id: input.projectId },
        data: { deletedAt: new Date() },
      });
    }),
  getTeamMembers: protectedProdecure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.userToProject.findMany({
        where: { projectId: input.projectId },
        include: { user: true },
      });
    }),
  getMyCredits: protectedProdecure.query(async ({ ctx }) => {
    return await ctx.db.user.findUnique({
      where: { id: ctx.user.userId! },
      select: { credits: true },
    });
  }),
  checkCredits: protectedProdecure
    .input(
      z.object({ githubUrl: z.string(), githubToken: z.string().optional() }),
    )
    .mutation(async ({ ctx, input }) => {
      // First validate the repository
      const validationResult = await validateGitHubRepo(
        input.githubUrl,
        input.githubToken,
      );

      if (!validationResult.isValid) {
        throw new Error(validationResult.error || "Invalid GitHub repository");
      }

      // If repo is private but no token provided
      if (!validationResult.isPublic && !input.githubToken) {
        throw new Error(
          "This repository is private. Please provide a GitHub token.",
        );
      }

      const fileCount =
        validationResult.fileCount ||
        (await checkCredits(input.githubUrl, input.githubToken));
      const userCredits = await ctx.db.user.findUnique({
        where: { id: ctx.user.userId! },
        select: { credits: true },
      });

      return {
        fileCount,
        userCredits: userCredits?.credits || 0,
        repoName: validationResult.repoFullName,
        isPrivate: !validationResult.isPublic,
      };
    }),
});
