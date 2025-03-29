import { db } from "@/server/db";
import type { Config } from "@netlify/functions";
import { ProjectCreationStatus } from "@prisma/client";
import { z } from "zod";

import { getInstallationToken } from "@/lib/github-app";
import { checkCredits, indexGithubRepo } from "@/lib/github-loader";
import { validateGitHubRepo } from "@/lib/github-validator";

// Define the request body schema
const bodyParser = z.object({
  name: z.string(),
  githubUrl: z.string(),
  branch: z.string(),
  userId: z.string(),
  projectCreationId: z.string(),
});

export default async (request: Request) => {
  try {
    // Parse request body
    const body = await request.json();
    const { name, githubUrl, branch, userId, projectCreationId } =
      bodyParser.parse(body);

    console.log(
      `Creating project "${name}" for user ${userId} from repository ${githubUrl} (branch: ${branch})`,
    );

    // Update status to CREATING_PROJECT
    await db.projectCreation.update({
      where: { id: projectCreationId },
      data: { status: ProjectCreationStatus.CREATING_PROJECT },
    });

    try {
      // Get the user's GitHub token
      const token = await getInstallationToken(userId);
      const githubToken = token || undefined;

      // Validate the repository
      const validationResult = await validateGitHubRepo(githubUrl, githubToken);

      if (!validationResult.isValid) {
        throw new Error(validationResult.error || "Invalid repository");
      }

      // For private repos, require GitHub App installation
      if (!validationResult.isPublic && !token) {
        throw new Error("Private repository requires GitHub App installation");
      }

      // Check if user has enough credits
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Get the accurate file count using checkCredits
      const fileCount = await checkCredits(githubUrl, branch, githubToken);
      console.log(`Accurate file count for charging: ${fileCount}`);

      // Update file count in ProjectCreation
      await db.projectCreation.update({
        where: { id: projectCreationId },
        data: { fileCount },
      });

      if (user.credits < fileCount) {
        throw new Error("Not enough credits to create this project");
      }

      // Create project and update credits in a transaction
      const project = await db.$transaction(async (tx) => {
        // Create the project
        const project = await tx.project.create({
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

        // Update user credits using the accurate file count
        await tx.user.update({
          where: { id: userId },
          data: { credits: { decrement: fileCount } },
        });

        return project;
      });

      console.log(`Project created with ID: ${project.id}`);

      // Update ProjectCreation with projectId and INDEXING status
      await db.projectCreation.update({
        where: { id: projectCreationId },
        data: {
          projectId: project.id,
          status: ProjectCreationStatus.INDEXING,
        },
      });

      // Return response immediately - the background processing continues
      const responseBody = JSON.stringify({
        success: true,
        projectId: project.id,
        message: "Project created successfully, indexing in progress",
      });

      console.log(`Preparing response with body: ${responseBody}`);

      const response = new Response(responseBody, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });

      // Send response before continuing with long-running operations
      await response.clone().text();
      console.log(`Response being sent: ${responseBody}`);

      // The background process continues after response is sent
      console.log(`Starting source code indexing for project ${project.id}`);

      try {
        // Index the repository
        await indexGithubRepo(project.id, githubUrl, branch, githubToken);
        console.log(`Source code indexing completed for project ${project.id}`);

        // Update ProjectCreation status to COMPLETED
        await db.projectCreation.update({
          where: { id: projectCreationId },
          data: { status: ProjectCreationStatus.COMPLETED },
        });

        // We're not going to process commits here - that will be handled by the client
        // to avoid issues with timing and to make sure the request completes
      } catch (indexError) {
        // Log but don't fail - project was already created
        console.error(`Error during repository indexing: ${indexError}`);
        console.log("Project was created successfully despite indexing error");

        // Update ProjectCreation with error but still set status as COMPLETED
        // since the project exists and is usable
        await db.projectCreation.update({
          where: { id: projectCreationId },
          data: {
            status: ProjectCreationStatus.COMPLETED,
            error: `Indexing error: ${indexError instanceof Error ? indexError.message : String(indexError)}`,
          },
        });
      }

      return response;
    } catch (error) {
      console.error("Project creation error:", error);

      // Update ProjectCreation with error status
      await db.projectCreation.update({
        where: { id: projectCreationId },
        data: {
          status: ProjectCreationStatus.ERROR,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("Request processing error:", error);

    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: error.issues }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

// Configure the function as a replacement for the Next.js API route
export const config: Config = {
  path: "/api/create-project",
};
