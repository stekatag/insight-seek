import { db } from "@/server/db";
import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { Octokit } from "octokit";

import { generateEmbedding, summarizeCode } from "./gemini";

const getFileCount = async (
  path: string,
  octokit: Octokit,
  githubOwner: string,
  githubRepo: string,
  branch: string,
  acc: number = 0,
): Promise<number> => {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: githubOwner,
      repo: githubRepo,
      path: path,
      ref: branch,
    });

    if (!Array.isArray(data) && data.type === "file") {
      return acc + 1;
    }

    if (Array.isArray(data)) {
      let fileCount = 0;

      // Limit the number of directories we process to avoid rate limits
      const directories: string[] = [];

      // Count files and collect directories in current level
      for (const item of data) {
        if (item.type === "dir") {
          // Skip node_modules and similar directories
          if (!shouldSkipDirectory(item.path)) {
            directories.push(item.path);
          }
        } else {
          fileCount += 1;
        }
      }

      // Limit the number of directories we'll process to avoid hitting rate limits
      const MAX_DIRS_TO_PROCESS = 20;
      const dirsToProcess = directories.slice(0, MAX_DIRS_TO_PROCESS);

      if (directories.length > MAX_DIRS_TO_PROCESS) {
        console.log(
          `Limiting directory scan to ${MAX_DIRS_TO_PROCESS} directories out of ${directories.length}`,
        );
        // Add an estimate for skipped directories
        fileCount += (directories.length - MAX_DIRS_TO_PROCESS) * 5; // Assume 5 files per directory
      }

      // Process directories in sequence to reduce concurrent requests
      for (const dirPath of dirsToProcess) {
        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
        const dirCount = await getFileCount(
          dirPath,
          octokit,
          githubOwner,
          githubRepo,
          branch,
          0,
        );
        fileCount += dirCount;
      }

      return acc + fileCount;
    }

    return acc;
  } catch (error: any) {
    console.error(`Error counting files for path ${path}:`, error);

    // If we hit rate limits, make a reasonable estimate
    if (
      error.status === 403 &&
      error.message?.includes("API rate limit exceeded")
    ) {
      console.warn("Rate limit exceeded during file count, using estimate");
      return acc + 5; // Assume approximately 5 files per directory when rate limited
    }

    // Skip this path if there's an error
    return acc;
  }
};

// Helper function to determine if we should skip a directory
function shouldSkipDirectory(path: string): boolean {
  const skipDirs = [
    "node_modules",
    "dist",
    "build",
    ".git",
    "coverage",
    ".next",
    "vendor",
    "tmp",
    ".github",
  ];

  return skipDirs.some((dir) => path.includes(dir));
}

export const checkCredits = async (
  githubUrl: string,
  branch: string,
  githubToken?: string,
): Promise<number> => {
  try {
    const octokit = new Octokit({
      auth: githubToken,
    });

    const githubOwner = githubUrl.split("/")[3];
    const githubRepo = githubUrl.split("/")[4];

    if (!githubOwner || !githubRepo) return 0;

    // Check rate limit before making calls
    try {
      const { data: rateLimit } = await octokit.rest.rateLimit.get();
      console.log(
        `Rate limit remaining: ${rateLimit.resources.core.remaining}/${rateLimit.resources.core.limit}`,
      );

      if (rateLimit.resources.core.remaining < 10) {
        console.warn("GitHub API rate limit almost exhausted!");
        // Continue anyway, but at reduced detail level
      }
    } catch (rateLimitError) {
      console.error("Failed to check rate limits:", rateLimitError);
      // Continue with the operation
    }

    const fileCount = await getFileCount(
      "",
      octokit,
      githubOwner,
      githubRepo,
      branch,
      0,
    );

    return fileCount;
  } catch (error) {
    console.error("Error checking credits:", error);
    // Return a reasonable default if we hit rate limits
    return 100; // Default estimate if we can't get actual count
  }
};

export async function loadGithubRepo(
  githubUrl: string,
  branch: string,
  githubToken?: string,
) {
  const loader = new GithubRepoLoader(githubUrl, {
    accessToken: githubToken,
    branch: branch, // Use the specified branch
    ignoreFiles: [
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "bun.lockb",
      "*.min.js",
      "*.min.css",
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
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
  branch: string,
  githubToken?: string,
): Promise<boolean> {
  try {
    console.log(
      `Starting to index GitHub repository: ${githubUrl} (branch: ${branch}) for project ${projectId}`,
    );

    // First, load all documents from the GitHub repo
    const docs = await loadGithubRepo(githubUrl, branch, githubToken);
    console.log(`Loaded ${docs.length} documents from repository`);

    // Generate embeddings for all files
    console.log("Generating embeddings for repository files...");
    const allEmbeddings = await generateEmbeddings(docs);

    // Process all embeddings and save them to the database
    console.log(
      `Processing ${allEmbeddings.length} embeddings and saving to database...`,
    );

    const results = await Promise.allSettled(
      allEmbeddings.map(async (embedding, index) => {
        console.log(
          `Processing embedding ${index + 1} of ${allEmbeddings.length}`,
        );

        if (!embedding) {
          console.warn(`Skipping embedding ${index + 1} - no embedding data`);
          return null;
        }

        try {
          // Create the source code embedding record
          const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
            data: {
              summary: embedding.summary,
              sourceCode: embedding.sourceCode,
              fileName: embedding.fileName,
              projectId,
            },
          });

          // Update the vector embedding with raw SQL (can't do this with Prisma alone)
          await db.$executeRaw`
          UPDATE "SourceCodeEmbedding"
          SET "summaryEmbedding" = ${embedding.embedding}::vector
          WHERE "id" = ${sourceCodeEmbedding.id}`;

          return sourceCodeEmbedding.id;
        } catch (error) {
          console.error(`Error saving embedding ${index + 1}:`, error);
          return null;
        }
      }),
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value,
    ).length;
    console.log(
      `Successfully created ${successCount} out of ${allEmbeddings.length} source code embeddings`,
    );

    return true;
  } catch (error) {
    console.error("Error indexing GitHub repository:", error);
    throw error;
  }
}

async function generateEmbeddings(docs: Document[]) {
  console.log(
    `Starting to generate embeddings for ${docs.length} documents...`,
  );

  const results = await Promise.all(
    docs.map(async (doc, index) => {
      try {
        console.log(
          `Processing document ${index + 1}/${docs.length}: ${doc.metadata.source}`,
        );

        // Generate summary of the code
        const summary = await summarizeCode(doc);
        if (!summary) {
          console.warn(`Failed to generate summary for ${doc.metadata.source}`);
          return null;
        }

        // Generate embedding vector for the summary
        const embedding = await generateEmbedding(summary);
        if (!embedding) {
          console.warn(
            `Failed to generate embedding for ${doc.metadata.source}`,
          );
          return null;
        }

        // Return the complete embedding object
        return {
          summary,
          embedding,
          sourceCode: doc.pageContent,
          fileName: doc.metadata.source,
        };
      } catch (error) {
        console.error(
          `Error generating embedding for ${doc.metadata.source}:`,
          error,
        );
        return null;
      }
    }),
  );

  // Filter out any failed embeddings
  return results.filter(Boolean);
}
