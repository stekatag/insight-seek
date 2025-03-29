import { ProjectCreationStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { isAbortOrTimeoutError } from "@/lib/error-utils";
import { getInstallationToken } from "@/lib/github-app";
import { checkCredits, indexGithubRepo } from "@/lib/github-loader";
import { validateGitHubRepo } from "@/lib/github-validator";

import { createTRPCRouter, protectedProdecure } from "../trpc";

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
      // Convert null to undefined to satisfy TypeScript
      const token = input.githubToken || undefined;
      return await validateGitHubRepo(input.githubUrl, token);
    }),

  // Create a new project
  createProject: protectedProdecure
    .input(
      z.object({
        name: z.string(),
        githubUrl: z.string(),
        branch: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId!;

      // Get the user's GitHub token if they have one
      const token = await getInstallationToken(userId);

      // Ensure token is either string or undefined, not null
      const githubToken = token || undefined;

      // Validate the repository
      const validationResult = await validateGitHubRepo(
        input.githubUrl,
        githubToken,
      );

      if (!validationResult.isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: validationResult.error || "Invalid repository",
        });
      }

      // For private repos, require GitHub App installation
      if (!validationResult.isPublic && !token) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Private repository requires GitHub App installation",
        });
      }

      // Check if user has enough credits
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get the accurate file count using checkCredits
      const fileCount = await checkCredits(
        input.githubUrl,
        input.branch,
        githubToken,
      );
      console.log(`Accurate file count for charging: ${fileCount}`);

      if (user.credits < fileCount) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not enough credits to create this project",
        });
      }

      // Create project and update credits in a transaction
      const project = await ctx.db.$transaction(async (tx) => {
        // Create the project
        const project = await tx.project.create({
          data: {
            name: input.name,
            githubUrl: input.githubUrl,
            branch: input.branch, // Store the selected branch
            userToProjects: {
              create: {
                userId: userId,
              },
            },
          },
        });

        // Update user credits using the accurate file count
        await tx.user.update({
          where: { id: userId },
          data: { credits: { decrement: fileCount } },
        });

        return project;
      });

      try {
        // Wait for the indexing to complete with the specified branch
        console.log(`Starting source code indexing for project ${project.id}`);

        // Set a timeout promise to handle long-running indexing
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Indexing timeout, but project was created successfully",
              ),
            );
          }, 300000); // 5 minutes timout
        });

        // Race the indexing process against the timeout
        await Promise.race([
          indexGithubRepo(
            project.id,
            input.githubUrl,
            input.branch,
            githubToken,
          ),
          timeoutPromise,
        ]);

        console.log(`Source code indexing completed for project ${project.id}`);
      } catch (error) {
        console.error(`Error during repository indexing:`, error);

        // Check if this is a timeout or stream closed error
        if (
          isAbortOrTimeoutError(error) ||
          (error instanceof Error && error.message?.includes("timeout"))
        ) {
          console.warn(
            "Indexing timed out but project was created successfully:",
            error,
          );

          // Create a new error with the project ID included
          const timeoutError = new TRPCError({
            code: "TIMEOUT",
            message: "Project created, but indexing timed out",
          });

          // Add projectId to the error data
          // @ts-expect-error - Adding custom data to the error
          timeoutError.data = { projectId: project.id };

          throw timeoutError;
        } else {
          // Other errors might be more serious but still return the project
          console.error("Unexpected error during indexing:", error);
        }
      }

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
        // Delete chats and related questions
        // First find all chats for this project
        const chats = await tx.chat.findMany({
          where: { projectId: input.projectId },
          select: { id: true },
        });

        // Then delete all questions associated with these chats
        await tx.question.deleteMany({
          where: {
            OR: [
              { projectId: input.projectId },
              { chatId: { in: chats.map((chat) => chat.id) } },
            ],
          },
        });

        // Now delete the chats themselves
        await tx.chat.deleteMany({
          where: { projectId: input.projectId },
        });

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

        // Delete standalone questions that weren't associated with chats
        // Note: we already deleted chat-associated questions above
        // This is technically redundant with the earlier deletion but ensures we get everything
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

  // 1. First step: Just validate the repository URL and get branches
  validateRepository: protectedProdecure
    .input(
      z.object({
        githubUrl: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId!;

      try {
        // Get the user's GitHub token if they have one
        const token = await getInstallationToken(userId);
        const githubToken = token || undefined;

        // Basic validation without file counting
        const validationResult = await validateGitHubRepo(
          input.githubUrl,
          githubToken,
        );

        if (!validationResult.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: validationResult.error || "Invalid repository",
          });
        }

        // For private repos, require GitHub App installation
        if (!validationResult.isPublic && !token) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Private repository requires GitHub App installation",
          });
        }

        return {
          isValid: true,
          repoName: validationResult.repoFullName,
          branches: validationResult.branches || [],
          defaultBranch: validationResult.defaultBranch || "main",
          isPrivate: !validationResult.isPublic,
        };
      } catch (error) {
        console.error("Repository validation error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to validate repository",
        });
      }
    }),

  // 2. Second step: Check file count and credits once branch is selected
  checkCredits: protectedProdecure
    .input(
      z.object({
        githubUrl: z.string(),
        branch: z.string().min(1, "Branch name is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId!;

      try {
        // Get the user's GitHub token
        const token = await getInstallationToken(userId);
        const githubToken = token || undefined;

        // Get user credits
        const user = await ctx.db.user.findUnique({
          where: { id: userId },
          select: { credits: true },
        });

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // Count files with the specified branch
        let fileCount;
        try {
          fileCount = await checkCredits(
            input.githubUrl,
            input.branch,
            githubToken,
          );
        } catch (countError) {
          if (isAbortOrTimeoutError(countError, undefined)) {
            console.warn("Stream closed during credit check, using estimate");
            fileCount = 150; // Conservative estimate
          } else {
            throw countError; // Re-throw other errors
          }
        }

        return {
          fileCount: fileCount || 0,
          userCredits: user.credits,
          hasEnoughCredits: (user.credits || 0) >= (fileCount || 0),
        };
      } catch (error) {
        console.error("Error checking credits:", error);

        if (isAbortOrTimeoutError(error, undefined)) {
          throw new TRPCError({
            code: "TIMEOUT",
            message:
              "Connection timed out. The repository might be too large. Please try again later.",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to check repository credits",
        });
      }
    }),

  // New endpoint to get repository validation status
  getValidationStatus: protectedProdecure
    .input(
      z.object({
        githubUrl: z.string(),
        branch: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.userId!;

      // Fetch validation result from database
      const validationResult = await ctx.db.validationResult.findUnique({
        where: {
          userId_githubUrl_branch: {
            userId,
            githubUrl: input.githubUrl,
            branch: input.branch,
          },
        },
      });

      if (!validationResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Validation result not found",
        });
      }

      return validationResult;
    }),

  // New endpoint to start project creation process
  startProjectCreation: protectedProdecure
    .input(
      z.object({
        name: z.string(),
        githubUrl: z.string(),
        branch: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId!;

      try {
        // First, check if a record with these details already exists
        const existingRecord = await ctx.db.projectCreation.findFirst({
          where: {
            userId,
            name: input.name,
            githubUrl: input.githubUrl,
            branch: input.branch,
          },
        });

        let projectCreation;

        if (existingRecord) {
          // If completed with a projectId, check if the project still exists
          if (
            existingRecord.status === ProjectCreationStatus.COMPLETED &&
            existingRecord.projectId
          ) {
            // Check if the project still exists
            const project = await ctx.db.project.findUnique({
              where: { id: existingRecord.projectId },
            });

            if (project) {
              // Project exists, we can just return the existing record
              return {
                success: true,
                projectCreationId: existingRecord.id,
                message: "Project creation record already exists",
              };
            }
          }

          // If the existing record is in an ERROR or COMPLETED state, we can re-use it
          if (
            existingRecord.status === ProjectCreationStatus.ERROR ||
            existingRecord.status === ProjectCreationStatus.COMPLETED
          ) {
            // Update the existing record to INITIALIZING to start again
            projectCreation = await ctx.db.projectCreation.update({
              where: { id: existingRecord.id },
              data: {
                status: ProjectCreationStatus.INITIALIZING,
                error: null, // Clear any previous error
                updatedAt: new Date(), // Update the timestamp
              },
            });
          } else {
            // If it's still in progress, just return the existing ID
            projectCreation = existingRecord;
          }
        } else {
          // No existing record, create a new one
          projectCreation = await ctx.db.projectCreation.create({
            data: {
              userId,
              name: input.name,
              githubUrl: input.githubUrl,
              branch: input.branch,
              status: ProjectCreationStatus.INITIALIZING,
            },
          });
        }

        return {
          success: true,
          projectCreationId: projectCreation.id,
          message: "Project creation initialized",
        };
      } catch (error) {
        console.error("Error starting project creation:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to start project creation",
        });
      }
    }),

  // New endpoint to get project creation status
  getProjectCreationStatus: protectedProdecure
    .input(z.object({ projectCreationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.userId!;

      try {
        // Fetch project creation status
        const creationStatus = await ctx.db.projectCreation.findUnique({
          where: {
            id: input.projectCreationId,
            userId, // Ensure it belongs to the current user
          },
        });

        if (!creationStatus) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project creation record not found",
          });
        }

        return creationStatus;
      } catch (error) {
        console.error("Error fetching project creation status:", error);

        // Rethrow NOT_FOUND errors
        if (error instanceof TRPCError && error.code === "NOT_FOUND") {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get project creation status",
        });
      }
    }),
});
