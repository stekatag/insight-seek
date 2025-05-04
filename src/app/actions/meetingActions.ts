"use server";

import type { processMeetingTask } from "@/trigger/processMeeting";
import { auth } from "@clerk/nextjs/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

// Input schema for the server action
const actionInputSchema = z.object({
  meetingId: z.string(),
  meetingUrl: z.string().url(),
});

export async function triggerMeetingProcessingAction(input: {
  meetingId: string;
  meetingUrl: string;
}) {
  const { userId } = await auth();
  if (!userId) {
    console.error("Meeting Processing Action Error: User not authenticated.");
    return { success: false, error: "Authentication required." };
  }

  // Validate input
  const parseResult = actionInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error(
      "Meeting Processing Action Error: Invalid input",
      parseResult.error.flatten(),
    );
    return { success: false, error: "Invalid input provided." };
  }

  const { meetingId, meetingUrl } = parseResult.data;

  // Note: Could add a check here to ensure the user owns the meetingId if needed

  try {
    // Trigger the meeting processing task
    const handle = await tasks.trigger<typeof processMeetingTask>(
      "process-meeting", // Task ID
      {
        // Payload matching the task's schema
        meetingId,
        meetingUrl,
        userId, // Pass userId for potential use in task
      },
    );

    console.log(
      `Server Action: Triggered process-meeting task run ${handle.id} for meeting ${meetingId}`,
    );
    return { success: true, error: null, runId: handle.id };
  } catch (error) {
    console.error(
      "Server Action Error: Failed to trigger meeting processing task:",
      error,
    );
    return { success: false, error: "Failed to start meeting processing." };
  }
}
