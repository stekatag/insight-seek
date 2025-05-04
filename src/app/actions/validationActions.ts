"use server";

import { db } from "@/server/db";
import type { validateRepositoryTask } from "@/trigger/validateRepository";
import { auth } from "@clerk/nextjs/server";
import { ValidationStatus } from "@prisma/client";
import { tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

// Input schema for the server action
const actionInputSchema = z.object({
  githubUrl: z.string().url(),
  branch: z.string(),
});

// Updated return type to include runId
export async function requestRepositoryValidationAction(input: {
  githubUrl: string;
  branch: string;
}): Promise<{
  success: boolean;
  error: string | null;
  runId: string | null; // Changed from validationId
}> {
  // Await auth() and then get userId
  const authResult = await auth();
  const userId = authResult?.userId;

  if (!userId) {
    console.error("Server Action Error: User not authenticated.");
    return {
      success: false,
      error: "Authentication required.",
      runId: null,
    };
  }

  // Validate input
  const parseResult = actionInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error(
      "Server Action Error: Invalid input",
      parseResult.error.flatten(),
    );
    return {
      success: false,
      error: "Invalid input provided.",
      runId: null,
    };
  }

  const { githubUrl, branch } = parseResult.data;
  let validationRecordId: string | null = null;

  try {
    // 1. Upsert Validation Record - Primarily to ensure it exists
    const validationRecord = await db.validationResult.upsert({
      where: {
        userId_githubUrl_branch: { userId, githubUrl, branch },
      },
      // Still set PROCESSING on update/create for initial state
      update: {
        status: ValidationStatus.PROCESSING,
        error: null,
        fileCount: null,
        userCredits: null,
        hasEnoughCredits: null,
      },
      create: {
        userId,
        githubUrl,
        branch,
        status: ValidationStatus.PROCESSING,
      },
      // Select the ID to pass to the task if needed (optional but good practice)
      select: { id: true },
    });
    validationRecordId = validationRecord.id;

    // 2. Trigger the validation task
    const handle = await tasks.trigger<typeof validateRepositoryTask>(
      "validate-repository",
      {
        userId,
        githubUrl,
        branch,
        validationResultId: validationRecord.id, // Pass DB ID if task needs it
      },
    );

    console.log(
      `Server Action: Triggered task run ${handle.id} for validation DB record ${validationRecord.id}`,
    );

    // 3. Return success and the RUN ID
    return { success: true, error: null, runId: handle.id };
  } catch (error) {
    console.error(
      "Server Action Error: Failed to request repository validation:",
      error,
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error during validation request.";

    // Attempt to update DB record to ERROR state only if we know its ID
    if (validationRecordId) {
      try {
        await db.validationResult.update({
          where: { id: validationRecordId },
          data: {
            status: ValidationStatus.ERROR,
            error: "Failed to trigger validation task.",
          },
        });
      } catch (dbError) {
        console.error(
          "Server Action Error: Failed to update validation record to ERROR state:",
          dbError,
        );
      }
    }

    return {
      success: false,
      error: `Failed to start validation: ${errorMessage}`,
      runId: null,
    };
  }
}
