import { db } from "@/server/db";
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
  validationResultId: z.string(), // Keep DB ID for logging if needed
});

// Define the output schema for the task
const validationOutputSchema = z.object({
  status: z.enum(["success", "error"]),
  fileCount: z.number().optional(),
  userCredits: z.number().optional(),
  error: z.string().optional(),
});

// Define the Trigger.dev Task using schemaTask
export const validateRepositoryTask = schemaTask({
  id: "validate-repository",
  schema: validationPayloadSchema,
  // Output schema is inferred from the run function's return type
  run: async (
    payload,
    { ctx },
  ): Promise<z.infer<typeof validationOutputSchema>> => {
    const { userId, githubUrl, branch, validationResultId } = payload;

    logger.info(
      `🚀 Starting repository validation (task run ${ctx.run.id}) for DB record: ${validationResultId}`,
      payload,
    );

    let userCredits: number | undefined;

    try {
      // --- Core Validation Logic ---

      // 1. Get GitHub Token
      const token = await getInstallationToken(userId);
      const githubToken = token || undefined;
      logger.info("GitHub token obtained.");

      // 2. Get User Credits
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (!user) {
        // Return error output directly, no DB update needed here
        logger.error(`User not found: ${userId}`);
        return {
          status: "error",
          error: `User not found: ${userId}`,
        };
      }
      userCredits = user.credits; // Store for later return
      logger.info(`User credits retrieved: ${userCredits}`);

      // 3. Validate the repository structure and access
      const validationData = await validateGitHubRepo(githubUrl, githubToken);

      if (!validationData.isValid) {
        const errorMsg =
          validationData.error || "Invalid repository configuration";
        logger.error("Repository structure validation failed.", {
          error: errorMsg,
        });
        // Return error output directly
        return { status: "error", error: errorMsg };
      }
      logger.info("Repository structure validated successfully.");

      // 4. Count files (check credits needed)
      const fileCount = await checkCredits(githubUrl, branch, githubToken);
      logger.info(`File count check completed: ${fileCount}`);

      // 5. NO DB UPDATE HERE

      logger.info("✅ Repository validation task completed successfully.", {
        fileCount,
        userCredits,
      });

      // 6. Return success output
      return {
        status: "success",
        fileCount,
        userCredits,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("❌ Repository validation task failed.", {
        error: errorMessage,
      });

      // NO DB UPDATE HERE

      // Return error output
      return {
        status: "error",
        error: errorMessage,
        // Include userCredits if we fetched them before the error
        userCredits: userCredits,
      };
      // Do not re-throw; let the task complete successfully but return error status
    }
  },
});
