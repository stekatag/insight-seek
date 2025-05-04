import type { createProjectTask } from "@/trigger/createProject";
import { ProjectCreationStatus } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk/v3";
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
        await indexGithubRepo(
          project.id,
          input.githubUrl,
          input.branch,
          githubToken,
        );
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
      // Use a longer timeout (2 minutes) to handle large projects
      return await ctx.db.$transaction(
        async (tx) => {
          // Delete chats and related questions
          const chats = await tx.chat.findMany({
            where: { projectId: input.projectId },
            select: { id: true },
          });
          await tx.question.deleteMany({
            where: {
              OR: [
                { projectId: input.projectId },
                { chatId: { in: chats.map((chat) => chat.id) } },
              ],
            },
          });
          await tx.chat.deleteMany({
            where: { projectId: input.projectId },
          });

          // Delete standalone questions that weren't associated with chats
          await tx.question.deleteMany({
            where: { projectId: input.projectId },
          });
          await tx.sourceCodeEmbedding.deleteMany({
            where: { projectId: input.projectId },
          });
          await tx.commit.deleteMany({
            where: { projectId: input.projectId },
          });
          await tx.userToProject.deleteMany({
            where: { projectId: input.projectId },
          });

          // Finally, delete the project itself
          return await tx.project.delete({
            where: { id: input.projectId },
          });
        },
        {
          timeout: 120000, // 2 minutes timeout instead of the default 5 seconds
        },
      );
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

  // Get validation status (used for polling by frontend)
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

  // Start the project creation process by triggering the background task
  startProjectCreation: protectedProdecure
    .input(
      z.object({
        name: z.string(),
        githubUrl: z.string().url(),
        branch: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.userId!;
      let projectCreationId: string | null = null;
      let needsTrigger = true;

      try {
        // Check if a ProjectCreation record already exists for this exact combination
        const existingCreation = await ctx.db.projectCreation.findUnique({
          where: {
            userId_githubUrl_branch_name: {
              userId,
              githubUrl: input.githubUrl,
              branch: input.branch,
              name: input.name,
            },
          },
        });

        if (existingCreation) {
          if (
            existingCreation.status === ProjectCreationStatus.INITIALIZING ||
            existingCreation.status ===
              ProjectCreationStatus.CREATING_PROJECT ||
            existingCreation.status === ProjectCreationStatus.INDEXING
          ) {
            projectCreationId = existingCreation.id;
            needsTrigger = false;
          } else {
            await ctx.db.projectCreation.delete({
              where: { id: existingCreation.id },
            });
          }
        }

        if (!projectCreationId) {
          const newProjectCreation = await ctx.db.projectCreation.create({
            data: {
              userId,
              name: input.name,
              githubUrl: input.githubUrl,
              branch: input.branch,
              status: ProjectCreationStatus.INITIALIZING,
            },
          });
          projectCreationId = newProjectCreation.id;
          needsTrigger = true;
        }

        if (needsTrigger && projectCreationId) {
          const handle = await tasks.trigger<typeof createProjectTask>(
            "create-project",
            {
              userId,
              name: input.name,
              githubUrl: input.githubUrl,
              branch: input.branch,
              projectCreationId: projectCreationId,
            },
          );
        }

        return {
          success: true,
          projectCreationId: projectCreationId,
          message: needsTrigger
            ? "Project creation task triggered successfully."
            : "Project creation already in progress.",
        };
      } catch (error) {
        console.error("Error in startProjectCreation mutation:", error);
        if (projectCreationId && needsTrigger) {
          try {
            await ctx.db.projectCreation.update({
              where: { id: projectCreationId },
              data: {
                status: ProjectCreationStatus.ERROR,
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to trigger creation task.",
              },
            });
          } catch (dbError) {
            console.error(
              `Failed to update ProjectCreation ${projectCreationId} to ERROR:`,
              dbError,
            );
          }
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error && (error as any).code === "P2002"
              ? "A project creation process with this exact name, repository, and branch might already exist or recently failed."
              : "Failed to start project creation task.",
          cause: error,
        });
      }
    }),

  // Get project creation status (remains the same)
  getProjectCreationStatus: protectedProdecure
    .input(z.object({ projectCreationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.userId!;

      try {
        // Fetch project creation status
        const creationStatus = await ctx.db.projectCreation.findUnique({
          where: {
            id: input.projectCreationId,
            userId,
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
