import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getRepositoryBranches } from "@/lib/github-api";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "Owner and repo parameters are required" },
      { status: 400 },
    );
  }

  try {
    const branches = await getRepositoryBranches(userId, owner, repo);

    return NextResponse.json({ branches });
  } catch (error) {
    console.error(`Error fetching branches for ${owner}/${repo}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch repository branches" },
      { status: 500 },
    );
  }
}
