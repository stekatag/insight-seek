import { db } from "@/server/db";
import type { Config } from "@netlify/functions";
import { ValidationStatus } from "@prisma/client";
import { z } from "zod";

import { getInstallationToken } from "@/lib/github-app";
import { checkCredits } from "@/lib/github-loader";
import { validateGitHubRepo } from "@/lib/github-validator";

// Define the request body schema
const bodyParser = z.object({
  githubUrl: z.string(),
  branch: z.string(),
  userId: z.string(),
});

export default async (request: Request) => {
  try {
    // Parse request body
    const body = await request.json();
    const { githubUrl, branch, userId } = bodyParser.parse(body);

    console.log(
      `Validating repository ${githubUrl} branch ${branch} for user ${userId}`,
    );

    // Create or update validation record with PROCESSING status
    const validationResult = await db.validationResult.upsert({
      where: {
        userId_githubUrl_branch: {
          userId,
          githubUrl,
          branch,
        },
      },
      update: {
        status: ValidationStatus.PROCESSING,
        error: null,
      },
      create: {
        userId,
        githubUrl,
        branch,
        status: ValidationStatus.PROCESSING,
      },
    });

    // Return response immediately - the background processing continues
    const response = new Response(
      JSON.stringify({
        validationId: validationResult.id,
        status: "processing",
      }),
      {
        status: 202,
        headers: { "Content-Type": "application/json" },
      },
    );

    // This ensures the response is sent before we continue processing
    await response.clone().text();

    // The background process continues after response is sent
    console.log(`Starting background validation for repository ${githubUrl}`);

    try {
      // Get the user's GitHub token if available
      const token = await getInstallationToken(userId);
      const githubToken = token || undefined;

      // Get user credits
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Validate the repository
      const validationData = await validateGitHubRepo(githubUrl, githubToken);

      if (!validationData.isValid) {
        await db.validationResult.update({
          where: { id: validationResult.id },
          data: {
            status: ValidationStatus.ERROR,
            error: validationData.error || "Invalid repository",
          },
        });
        return response;
      }

      // Count files with the specified branch
      const fileCount = await checkCredits(githubUrl, branch, githubToken);

      // Update validation result with success data
      await db.validationResult.update({
        where: { id: validationResult.id },
        data: {
          status: ValidationStatus.COMPLETED,
          fileCount,
          userCredits: user.credits,
          hasEnoughCredits: user.credits >= fileCount,
        },
      });

      console.log(
        `Repository validation completed successfully for ${githubUrl}`,
      );
      return response;
    } catch (error) {
      console.error("Repository validation error:", error);

      // Update validation result with error
      await db.validationResult.update({
        where: { id: validationResult.id },
        data: {
          status: ValidationStatus.ERROR,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return response;
    }
  } catch (error) {
    console.error("Validation process error:", error);

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
  path: "/api/validate-repository",
};
