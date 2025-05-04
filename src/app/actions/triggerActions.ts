"use server";

import { auth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk/v3";
import { z } from "zod";

// Input schema for the action
const inputSchema = z.object({
  runId: z.string(),
});

/**
 * Generates a short-lived public access token scoped to a specific run ID.
 */
export async function generateTriggerRunToken(input: {
  runId: string;
}): Promise<{
  success: boolean;
  token: string | null;
  error: string | null;
}> {
  // Ensure user is authenticated (optional but recommended)
  const authResult = await auth();
  if (!authResult?.userId) {
    return {
      success: false,
      token: null,
      error: "Authentication required.",
    };
  }

  // Validate input
  const parseResult = inputSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      token: null,
      error: "Invalid run ID provided.",
    };
  }

  const { runId } = parseResult.data;

  try {
    const publicToken = await triggerAuth.createPublicToken({
      scopes: {
        read: {
          runs: [runId], // Scope token to only read this specific run
        },
      },
      expirationTime: "1h", // Token expires in 1 hour
    });

    return { success: true, token: publicToken, error: null };
  } catch (error) {
    console.error(
      `Failed to generate Trigger.dev token for run ${runId}:`,
      error,
    );
    return {
      success: false,
      token: null,
      error: "Failed to generate access token.",
    };
  }
}
