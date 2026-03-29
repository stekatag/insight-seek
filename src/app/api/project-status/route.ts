import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400 },
    );
  }

  try {
    // Check if the user has access to this project
    const projectAccess = await db.userToProject.findFirst({
      where: {
        projectId,
        userId,
      },
    });

    if (!projectAccess) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get project details
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    // Count source code embeddings
    const embeddingsCount = await db.sourceCodeEmbedding.count({
      where: { projectId },
    });

    // Count commits
    const commitsCount = await db.commit.count({
      where: { projectId },
    });

    return NextResponse.json({
      project,
      status: {
        hasSourceCodeEmbeddings: embeddingsCount > 0,
        embeddingsCount,
        hasCommits: commitsCount > 0,
        commitsCount,
        isFullyIndexed: embeddingsCount > 0,
      },
    });
  } catch (error) {
    console.error("Error checking project status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
