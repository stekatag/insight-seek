import { db } from "@/server/db";
import axios from "axios";
import { Octokit } from "octokit";
import { aiSummarizeCommit } from "./gemini";

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

type Response = {
  commitHash: string;
  commitMessage: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commitDate: string;
};

export const getCommitHashes = async (
  githubUrl: string,
): Promise<Response[]> => {
  const [owner, repo] = githubUrl.split("/").slice(3, 5);
  if (!owner || !repo) {
    throw new Error("Invalid github url");
  }

  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
  });
  //   need commit author, commit message, commit hash and commit time
  const sortedCommits = data.sort(
    (a: any, b: any) =>
      new Date(b.commit.author.date).getTime() -
      new Date(a.commit.author.date).getTime(),
  ) as any[];

  return sortedCommits.slice(0, 15).map((commit: any) => ({
    commitHash: commit.sha as string,
    commitMessage: commit.commit.message ?? "",
    commitAuthorName: commit.commit?.author?.name ?? "",
    commitAuthorAvatar: commit.author?.avatar_url ?? "",
    commitDate: commit.commit?.author?.date ?? "",
  }));
};

export const pullCommits = async (projectId: string) => {
  const { project, githubUrl } = await fetchProjectGithubUrl(projectId);
  const commitHases = await getCommitHashes(project?.githubUrl ?? "");
  const unprocessedCommits = await filterUnprocessedCommits(
    projectId,
    commitHases,
  );
  const summariesResponse = await Promise.allSettled(
    unprocessedCommits.map((hash) => {
      return summarizeCommit(githubUrl, hash.commitHash);
    }),
  );
  const summaries = summariesResponse.map((summary) => {
    if (summary.status === "fulfilled") {
      return summary.value as string;
    }
  });
  const commits = await db.commit.createMany({
    data: summaries.map((summary, idx) => ({
      projectId: projectId,
      commitHash: unprocessedCommits[idx]!.commitHash,
      commitAuthorName: unprocessedCommits[idx]!.commitAuthorName,
      commitDate: unprocessedCommits[idx]!.commitDate,
      commitMessage: unprocessedCommits[idx]!.commitMessage,
      commitAuthorAvatar: unprocessedCommits[idx]!.commitAuthorAvatar,
      summary: summary!,
    })),
  });

  return commits;
};

async function summarizeCommit(githubUrl: string, commitHash: string) {
  // Get the diff, then pass it to the AI model
  const { data } = await axios.get(`${githubUrl}/commit/${commitHash}.diff`, {
    headers: {
      Accept: "application/vnd.github.v3.diff",
    },
  });
  return (await aiSummarizeCommit(data)) || "";
}

async function fetchProjectGithubUrl(projectId: string) {
  const project = await db.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      githubUrl: true,
    },
  });
  const githubUrl = project?.githubUrl ?? "";
  return { project, githubUrl };
}

async function filterUnprocessedCommits(
  projectId: string,
  commitHashes: Response[],
) {
  const processedCommits = await db.commit.findMany({
    where: { projectId },
  });

  const unprocessedCommits = commitHashes.filter(
    (commit) =>
      !processedCommits.some(
        (processedCommit) => processedCommit.commitHash === commit.commitHash,
      ),
  );

  return unprocessedCommits;
}
