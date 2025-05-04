import { db } from "@/server/db";
import { ProjectCreationStatus } from "@prisma/client";
import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { getInstallationToken } from "@/lib/github-app";
import { checkCredits, indexGithubRepo } from "@/lib/github-loader";
import { validateGitHubRepo } from "@/lib/github-validator";

// Define the input schema for the task payload
const createProjectPayloadSchema = z.object({
  userId: z.string(),
  name: z.string(),
  githubUrl: z.string().url(),
  branch: z.string(),
  projectCreationId: z.string(), // ID of the ProjectCreation record to update
});

// Define the Trigger.dev Task
export const createProjectTask = schemaTask({
  id: "create-project", // Unique ID for this task
  schema: createProjectPayloadSchema,
  run: async (payload, { ctx }) => {
    const { userId, name, githubUrl, branch, projectCreationId } = payload;

    logger.info(
      `🚀 Starting project creation for ID: ${projectCreationId}`,
      payload,
    );

    try {
      // 1. Update status to CREATING_PROJECT
      logger.info("Updating status to CREATING_PROJECT");
      await db.projectCreation.update({
        where: { id: projectCreationId },
        data: { status: ProjectCreationStatus.CREATING_PROJECT },
      });

      // 2. Get GitHub Token
      const token = await getInstallationToken(userId);
      const githubToken = token || undefined;
      logger.info("GitHub token obtained.");

      // 3. Validate the repository (again, ensures consistency)
      const validationResult = await validateGitHubRepo(githubUrl, githubToken);
      if (!validationResult.isValid) {
        throw new Error(
          validationResult.error ||
            "Invalid repository configuration during project creation",
        );
      }
      if (!validationResult.isPublic && !token) {
        throw new Error("Private repository requires GitHub App installation");
      }
      logger.info("Repository validation passed.");

      // 4. Check credits and get file count
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
      logger.info(`User credits check: ${user.credits} available.`);

      const fileCount = await checkCredits(githubUrl, branch, githubToken);
      logger.info(`File count check completed: ${fileCount}`);

      // Update file count in ProjectCreation record
      await db.projectCreation.update({
        where: { id: projectCreationId },
        data: { fileCount },
      });

      if (user.credits < fileCount) {
        throw new Error("Not enough credits to create this project");
      }

      // 5. Create project and deduct credits in a transaction
      logger.info("Starting transaction to create project and deduct credits.");
      const project = await db.$transaction(async (tx) => {
        const newProject = await tx.project.create({
          data: {
            name,
            githubUrl,
            branch,
            userToProjects: {
              create: {
                userId,
              },
            },
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: { credits: { decrement: fileCount } },
        });

        // Link the project ID back to the creation record
        await tx.projectCreation.update({
          where: { id: projectCreationId },
          data: { projectId: newProject.id },
        });

        logger.info(`Project ${newProject.id} created within transaction.`);
        return newProject;
      });
      logger.info("Transaction completed successfully.");

      // 6. Index the repository
      logger.info(`Starting repository indexing for project ${project.id}`);
      await db.projectCreation.update({
        where: { id: projectCreationId },
        data: { status: ProjectCreationStatus.INDEXING },
      });
      await indexGithubRepo(project.id, githubUrl, branch, githubToken);
      logger.info(`Repository indexing completed for project ${project.id}`);

      // 7. Update ProjectCreation status to COMPLETED
      await db.projectCreation.update({
        where: { id: projectCreationId },
        data: { status: ProjectCreationStatus.COMPLETED, error: null }, // Clear any potential previous error
      });

      logger.info(
        `✅ Project creation task completed successfully for ID: ${projectCreationId}`,
      );
      return { status: "success", projectId: project.id };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `❌ Project creation task failed for ID: ${projectCreationId}`,
        { error: errorMessage },
      );

      // Attempt to update ProjectCreation status to ERROR
      try {
        await db.projectCreation.update({
          where: { id: projectCreationId },
          data: {
            status: ProjectCreationStatus.ERROR,
            error: errorMessage,
          },
        });
      } catch (dbError) {
        logger.error(
          "Failed to update project creation status to ERROR in DB after catching error.",
          { dbError },
        );
      }

      // Re-throwing the error marks the task run as FAILED
      throw error;
    }
  },
});
