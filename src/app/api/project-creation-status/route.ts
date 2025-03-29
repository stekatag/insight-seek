import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const projectCreationId = url.searchParams.get("projectCreationId");

  if (!projectCreationId) {
    return NextResponse.json(
      { error: "Project Creation ID is required" },
      { status: 400 },
    );
  }

  try {
    // Check if the user has access to this creation
    const projectCreation = await db.projectCreation.findUnique({
      where: {
        id: projectCreationId,
        userId,
      },
    });

    if (!projectCreation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get project ID if available
    let project = null;
    if (projectCreation.projectId) {
      project = await db.project.findUnique({
        where: { id: projectCreation.projectId },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      // Count source code embeddings if we have a project
      const embeddingsCount = await db.sourceCodeEmbedding.count({
        where: { projectId: projectCreation.projectId },
      });

      return NextResponse.json({
        projectCreation,
        project,
        indexingStatus: {
          hasSourceCodeEmbeddings: embeddingsCount > 0,
          embeddingsCount,
          isFullyIndexed:
            projectCreation.status === "COMPLETED" && embeddingsCount > 0,
        },
      });
    }

    // Just return the project creation status if no project yet
    return NextResponse.json({
      projectCreation,
      indexingStatus: null,
    });
  } catch (error) {
    console.error("Error checking project creation status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
