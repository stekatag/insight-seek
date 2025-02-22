import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { generateEmbedding, summarizeCode } from "./gemini";
import { db } from "@/server/db";

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
