import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { generateEmbedding, summarizeCode } from "./gemini";
import { db } from "@/server/db";
import { Octokit } from "octokit";

const getFileCount = async (
  path: string,
  octokit: Octokit,
  githubOwner: string,
  githubRepo: string,
  acc: number = 0,
) => {
  const { data } = await octokit.rest.repos.getContent({
    owner: githubOwner,
    repo: githubRepo,
    path: path,
  });

  if (!Array.isArray(data) && data.type === "file") {
    return acc + 1;
  }

  if (Array.isArray(data)) {
    let fileCount = 0;
    const directories: string[] = [];

    // Count files and collect directories in current level
    for (const item of data) {
      if (item.type === "dir") {
        directories.push(item.path);
      } else {
        fileCount += 1;
      }
    }

    // Process all directories at this level in parallel
    if (directories.length > 0) {
      const directoryCounts = await Promise.all(
        directories.map((dirPath) =>
          getFileCount(dirPath, octokit, githubOwner, githubRepo, 0),
        ),
      );
      fileCount += directoryCounts.reduce((sum, count) => sum + count, 0);
    }

    return acc + fileCount;
  }

  return acc;
};

export const checkCredits = async (githubUrl: string, githubToken?: string) => {
  const octokit = new Octokit({
    auth: githubToken || process.env.GITHUB_TOKEN,
  });
  const githubOwner = githubUrl.split("/")[3];
  const githubRepo = githubUrl.split("/")[4];

  if (!githubOwner || !githubRepo) return 0;

  const fileCount = await getFileCount("", octokit, githubOwner, githubRepo, 0);

  return fileCount;
};

export async function loadGithubRepo(githubUrl: string, githubToken?: string) {
  const loader = new GithubRepoLoader(githubUrl, {
    accessToken: githubToken || process.env.GITHUB_TOKEN,
    branch: "master",
    ignoreFiles: [
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "bun.lockb",
    ],
    recursive: true,
    unknown: "warn",
    maxConcurrency: 5,
  });
  const docs = await loader.load();
  return docs;
}

export async function indexGithubRepo(
  projectId: string,
  githubUrl: string,
  githubToken?: string,
) {
  const docs = await loadGithubRepo(githubUrl, githubToken);
  const allEmbeddings = await generateEmbeddings(docs);
  await Promise.allSettled(
    allEmbeddings.map(async (embedding, index) => {
      console.log(`processing ${index} of ${allEmbeddings.length}`);

      if (!embedding) return;

      const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
        data: {
          summary: embedding.summary,
          sourceCode: embedding.sourceCode,
          fileName: embedding.fileName,
          projectId,
        },
      });

      await db.$executeRaw`
      UPDATE "SourceCodeEmbedding"
      SET "summaryEmbedding" = ${embedding.embedding}::vector
      WHERE "id" = ${sourceCodeEmbedding.id}`;
    }),
  );
}

async function generateEmbeddings(docs: Document[]) {
  return await Promise.all(
    docs.map(async (doc) => {
      const summary = await summarizeCode(doc);
      const embedding = await generateEmbedding(summary);

      return {
        summary,
        embedding,
        sourceCode: JSON.parse(JSON.stringify(doc.pageContent)),
        fileName: doc.metadata.source,
      };
    }),
  );
}

// console.log(
//   await loadGithubRepo("https://github.com/stekatag/project-management-app"),
// );

// Document {
//   pageContent: "<?php\n\nreturn [\n\n    /*\n    |--------------------------------------------------------------------------\n    | Default Mailer\n    |---------or all emails sent by your application to be sent from\n    | the same address. Here you may specify a name and address that is\n    | used globally for all emails that are sent by your application.\n    |\n    */\n\n    'from' => [\n        'address' => env('MAIL_FROM_ADDRESS', 'hello@example.com'),\n        'name' => env('MAIL_FROM_NAME', 'Example'),\n    ],\n\n];\n",
//   metadata: {
//     source: "config/mail.php",
//     repository: "https://github.com/stekatag/project-management-app",
//     branch: "master",
//   },
//   id: undefined,
// }
