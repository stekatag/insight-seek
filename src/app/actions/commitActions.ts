"use server";

import { db } from "@/server/db";
import type { processCommitsTask } from "@/trigger/processCommits";
import type { reindexCommitsTask } from "@/trigger/reindexCommits";
import { auth } from "@clerk/nextjs/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

// Input schema for the server action
const actionInputSchema = z.object({
  projectId: z.string(),
  isProjectCreation: z.boolean().optional().default(false),
});

export async function triggerCommitProcessingAction(input: {
  projectId: string;
  isProjectCreation?: boolean;
}) {
  const { userId } = await auth(); // Assuming auth() needs await based on previous attempts
  if (!userId) {
    console.error("Commit Processing Action Error: User not authenticated.");
    return { success: false, error: "Authentication required." };
  }

  // Validate input
  const parseResult = actionInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error(
      "Commit Processing Action Error: Invalid input",
      parseResult.error.flatten(),
    );
    return { success: false, error: "Invalid project ID provided." };
  }

  const { projectId, isProjectCreation } = parseResult.data;

  try {
    // Fetch project details needed for the task payload
    const project = await db.project.findUnique({
      where: { id: projectId, userToProjects: { some: { userId } } }, // Ensure user has access
      select: { githubUrl: true },
    });

    if (!project) {
      console.error(
        `Commit Processing Action Error: Project not found or user (${userId}) lacks access to project ${projectId}.`,
      );
      return { success: false, error: "Project not found or access denied." };
    }

    // Trigger the commit processing task
    const handle = await tasks.trigger<typeof processCommitsTask>(
      "process-commits", // Task ID
      {
        // Payload matching the task's schema
        projectId,
        githubUrl: project.githubUrl,
        userId, // Pass userId for token fetching within the task
        isProjectCreation: isProjectCreation ?? false,
      },
    );

    console.log(
      `Server Action: Triggered process-commits task run ${handle.id} for project ${projectId}`,
    );
    return { success: true, error: null, runId: handle.id };
  } catch (error) {
    console.error(
      "Server Action Error: Failed to trigger commit processing:",
      error,
    );
    return { success: false, error: "Failed to start commit processing." };
  }
}

// --- New Server Action for Reindexing ---

// Input schema for the reindex server action
const reindexActionInputSchema = z.object({
  projectId: z.string(),
  githubUrl: z.string().url(),
  commitIds: z.array(z.string()),
});

export async function triggerReindexCommitsAction(input: {
  projectId: string;
  githubUrl: string;
  commitIds: string[];
}) {
  const { userId } = await auth();
  if (!userId) {
    console.error("Reindex Commits Action Error: User not authenticated.");
    return { success: false, error: "Authentication required." };
  }

  // Validate input
  const parseResult = reindexActionInputSchema.safeParse(input);
  if (!parseResult.success) {
    console.error(
      "Reindex Commits Action Error: Invalid input",
      parseResult.error.flatten(),
    );
    return { success: false, error: "Invalid input provided." };
  }

  const { projectId, githubUrl, commitIds } = parseResult.data;

  // Optional: Double-check user has access to the project before triggering
  const projectAccess = await db.project.count({
    where: { id: projectId, userToProjects: { some: { userId } } },
  });

  if (projectAccess === 0) {
    console.error(
      `Reindex Commits Action Error: User (${userId}) lacks access to project ${projectId}.`,
    );
    return { success: false, error: "Project access denied." };
  }

  try {
    // Trigger the reindex commits task
    const handle = await tasks.trigger<typeof reindexCommitsTask>(
      "reindex-commits", // Task ID
      {
        // Payload matching the task's schema
        projectId,
        githubUrl,
        commitIds,
        userId, // Pass userId for token fetching within the task
      },
    );

    console.log(
      `Server Action: Triggered reindex-commits task run ${handle.id} for project ${projectId}`,
    );
    return { success: true, error: null, runId: handle.id };
  } catch (error) {
    console.error(
      "Server Action Error: Failed to trigger reindex commits task:",
      error,
    );
    return { success: false, error: "Failed to start reindexing task." };
  }
}
