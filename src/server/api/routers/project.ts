import { z } from "zod";
import { createTRPCRouter, protectedProdecure } from "../trpc";
import { pullCommits } from "@/lib/github";
import { checkCredits, indexGithubRepo } from "@/lib/github-loader";
import { validateGitHubRepo } from "@/lib/github-validator";

export const projectRouter = createTRPCRouter({
  // Validate GitHub repository
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

  // Create a new project
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

  // Get all projects for the current user
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

  // Delete a project and all its related data
  deleteProject: protectedProdecure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // First, verify the user has permission to delete this project
      const projectAccess = await ctx.db.userToProject.findFirst({
        where: {
          projectId: input.projectId,
          userId: ctx.user.userId!,
        },
      });

      if (!projectAccess) {
        throw new Error("You don't have permission to delete this project");
      }

      // Delete project in a transaction to ensure all related data is deleted
      return await ctx.db.$transaction(async (tx) => {
        // Delete meetings and related data
        const meetings = await tx.meeting.findMany({
          where: { projectId: input.projectId },
          select: { id: true },
        });

        for (const meeting of meetings) {
          await tx.meetingEmbedding.deleteMany({
            where: { meetingId: meeting.id },
          });

          await tx.issue.deleteMany({
            where: { meetingId: meeting.id },
          });
        }

        await tx.meeting.deleteMany({
          where: { projectId: input.projectId },
        });

        // Delete questions
        await tx.question.deleteMany({
          where: { projectId: input.projectId },
        });

        // Delete code embeddings
        await tx.sourceCodeEmbedding.deleteMany({
          where: { projectId: input.projectId },
        });

        // Delete commits
        await tx.commit.deleteMany({
          where: { projectId: input.projectId },
        });

        // Delete user to project relationships
        await tx.userToProject.deleteMany({
          where: { projectId: input.projectId },
        });

        // Finally, delete the project itself
        return await tx.project.delete({
          where: { id: input.projectId },
        });
      });
    }),

  // Check required credits for a GitHub repository
  checkCredits: protectedProdecure
    .input(
      z.object({
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
