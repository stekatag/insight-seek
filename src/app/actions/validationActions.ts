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

export async function requestRepositoryValidationAction(input: {
  githubUrl: string;
  branch: string;
}) {
  // Await auth() and then get userId
  const authResult = await auth();
  const userId = authResult?.userId;

  if (!userId) {
    console.error("Server Action Error: User not authenticated.");
    return {
      success: false,
      error: "Authentication required.",
      validationId: null,
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
      validationId: null,
    };
  }

  const { githubUrl, branch } = parseResult.data;
  let validationResultId: string | null = null;

  try {
    // 1. Create/Update Validation Record in DB
    const validationResult = await db.validationResult.upsert({
      where: {
        userId_githubUrl_branch: { userId, githubUrl, branch },
      },
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
      select: { id: true },
    });
    validationResultId = validationResult.id;

    // 2. Trigger the validation task
    // Use tasks.trigger with the imported task type
    const handle = await tasks.trigger<typeof validateRepositoryTask>(
      "validate-repository", // Task ID
      {
        // Payload matching the task's schema
        userId,
        githubUrl,
        branch,
        validationResultId: validationResult.id,
      },
    );

    console.log(
      `Server Action: Triggered task run ${handle.id} for validation ${validationResult.id}`,
    );

    // Return success and the ID needed for polling
    return { success: true, error: null, validationId: validationResult.id };
  } catch (error) {
    console.error(
      "Server Action Error: Failed to request repository validation:",
      error,
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error during validation request.";

    // Attempt to update DB record to ERROR if it was created
    if (validationResultId) {
      try {
        await db.validationResult.update({
          where: { id: validationResultId },
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
      validationId: null,
    };
  }
}
