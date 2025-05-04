import { db } from "@/server/db";
import { ValidationStatus } from "@prisma/client";
import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { getInstallationToken } from "@/lib/github-app";
import { checkCredits } from "@/lib/github-loader";
import { validateGitHubRepo } from "@/lib/github-validator";

// Define the input schema for the task payload using Zod
const validationPayloadSchema = z.object({
  userId: z.string(),
  githubUrl: z.string().url(),
  branch: z.string(),
  validationResultId: z.string(), // ID of the ValidationResult record to update
});

// Define the Trigger.dev Task
export const validateRepositoryTask = schemaTask({
  id: "validate-repository", // Unique ID for this task
  // name: "Validate GitHub Repository", // Removed name property
  // Use the Zod schema for payload validation
  schema: validationPayloadSchema,
  // Define the run function that contains the task logic
  run: async (payload, { ctx }) => {
    const { userId, githubUrl, branch, validationResultId } = payload;

    logger.info(
      `🚀 Starting repository validation for ID: ${validationResultId}`,
      payload,
    );

    try {
      // --- Core Validation Logic ---

      // 1. Get GitHub Token (No need for io.runTask in v3 for simple async calls)
      const token = await getInstallationToken(userId);
      const githubToken = token || undefined;
      logger.info("GitHub token obtained.");

      // 2. Get User Credits
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (!user) {
        // Update status to ERROR before throwing
        await db.validationResult.update({
          where: { id: validationResultId },
          data: {
            status: ValidationStatus.ERROR,
            error: `User not found: ${userId}`,
          },
        });
        throw new Error(`User not found: ${userId}`);
      }
      logger.info(`User credits retrieved: ${user.credits}`);

      // 3. Validate the repository structure and access
      const validationData = await validateGitHubRepo(githubUrl, githubToken);

      if (!validationData.isValid) {
        logger.error("Repository structure validation failed.", {
          error: validationData.error,
        });
        await db.validationResult.update({
          where: { id: validationResultId },
          data: {
            status: ValidationStatus.ERROR,
            error: validationData.error || "Invalid repository configuration",
          },
        });
        // Return early, no need to throw, let the task complete as 'failed' via status update
        return { status: "error", reason: "Invalid repository structure" };
      }
      logger.info("Repository structure validated successfully.");

      // 4. Count files (check credits needed)
      const fileCount = await checkCredits(githubUrl, branch, githubToken);
      logger.info(`File count check completed: ${fileCount}`);

      // 5. Update validation result with success data
      const finalResult = await db.validationResult.update({
        where: { id: validationResultId },
        data: {
          status: ValidationStatus.COMPLETED,
          fileCount,
          userCredits: user.credits,
          hasEnoughCredits: user.credits >= fileCount,
          error: null, // Clear any previous error
        },
      });

      logger.info("✅ Repository validation task completed successfully.", {
        finalResult,
      });
      return { status: "success", fileCount, userCredits: user.credits };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("❌ Repository validation task failed.", {
        error: errorMessage,
      });

      // Attempt to update validation result with error status
      try {
        await db.validationResult.update({
          where: { id: validationResultId },
          data: {
            status: ValidationStatus.ERROR,
            error: errorMessage,
          },
        });
      } catch (dbError) {
        logger.error(
          "Failed to update validation status to ERROR in DB after catching error.",
          { dbError },
        );
      }

      // Re-throwing the error ensures Trigger.dev marks the run as FAILED
      throw error;
    }
  },
});
