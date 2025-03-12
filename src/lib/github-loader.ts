import { db } from "@/server/db";
import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { Octokit } from "octokit";

import { generateEmbedding, summarizeCode } from "./gemini";

// Modified getFileCount function to more accurately match what loadGithubRepo will process
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

    // Handle single file case
    if (!Array.isArray(data) && data.type === "file") {
      // Apply the same filtering that loadGithubRepo would apply
      if (shouldProcessFile(data.name, path)) {
        return acc + 1;
      }
      return acc;
    }

    if (Array.isArray(data)) {
      let fileCount = 0;
      const directories: string[] = [];

      // First pass: count files at this level
      for (const item of data) {
        if (item.type === "dir") {
          // Skip directories that we know we won't process
          if (!shouldSkipDirectory(item.path)) {
            directories.push(item.path);
          }
        } else if (item.type === "file") {
          // Only count files that would actually be processed
          if (shouldProcessFile(item.name, item.path)) {
            fileCount += 1;
          }
        }
      }

      // Process directories with rate limit protections
      const MAX_DIRS_TO_PROCESS = 20;

      // For large repos, prioritize directories more likely to contain source code
      const sortedDirectories = [...directories];
      if (directories.length > MAX_DIRS_TO_PROCESS) {
        // Sort directories to prioritize src, lib, app folders which likely contain more source files
        const priorityDirs = [
          "src/",
          "lib/",
          "app/",
          "core/",
          "main/",
          "source/",
          "components/",
        ];
        sortedDirectories.sort((a, b) => {
          const aPriority = priorityDirs.some((dir) => a.includes(dir)) ? 0 : 1;
          const bPriority = priorityDirs.some((dir) => b.includes(dir)) ? 0 : 1;
          return aPriority - bPriority;
        });
      }

      const dirsToProcess = sortedDirectories.slice(0, MAX_DIRS_TO_PROCESS);

      // If we're limiting directories, make a more accurate estimate based on what we've seen so far
      if (directories.length > MAX_DIRS_TO_PROCESS) {
        const remainingDirCount = directories.length - MAX_DIRS_TO_PROCESS;
        console.log(
          `Repository has ${directories.length} dirs; scanning ${MAX_DIRS_TO_PROCESS} and estimating the rest`,
        );
      }

      // Process directories we're keeping
      for (const dirPath of dirsToProcess) {
        // Add small delay to avoid rate limiting
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

      // For unscanned directories, estimate based on what we've seen so far
      if (directories.length > MAX_DIRS_TO_PROCESS) {
        // Calculate average files per directory from the ones we scanned
        const scannedDirCount = dirsToProcess.length;
        const averageFilesPerDir =
          scannedDirCount > 0 ? fileCount / scannedDirCount : 2;

        // Apply this average to remaining directories (with a small discount factor)
        const remainingDirs = directories.length - MAX_DIRS_TO_PROCESS;
        const estimatedAdditionalFiles = Math.ceil(
          averageFilesPerDir * remainingDirs * 0.8,
        );

        console.log(
          `Estimated additional ${estimatedAdditionalFiles} files in ${remainingDirs} unscanned directories`,
        );
        fileCount += estimatedAdditionalFiles;
      }

      return acc + fileCount;
    }

    return acc;
  } catch (error: any) {
    console.error(`Error counting files for path ${path}:`, error);

    // Better rate limit handling
    if (
      error.status === 403 &&
      error.message?.includes("API rate limit exceeded")
    ) {
      console.warn("Rate limit exceeded during file count, using estimate");
      // Return a slightly higher estimate since we hit a rate limit
      return acc + 10;
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

// Helper function to determine if we should process a file
// This should match the same logic used in loadGithubRepo
function shouldProcessFile(fileName: string, path: string): boolean {
  // Skip files we know GithubRepoLoader would ignore
  if (
    fileName === "package-lock.json" ||
    fileName === "yarn.lock" ||
    fileName === "pnpm-lock.yaml" ||
    fileName === "bun.lockb" ||
    fileName.endsWith(".min.js") ||
    fileName.endsWith(".min.css")
  ) {
    return false;
  }

  // Skip if in directories that GithubRepoLoader ignores
  if (
    path.includes("node_modules/") ||
    path.includes("dist/") ||
    path.includes("build/") ||
    path.includes(".next/")
  ) {
    return false;
  }

  // Skip binary files and non-source code files that tend to be large
  const binaryExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".ico",
    ".bmp",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".7z",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".mp3",
    ".mp4",
    ".avi",
    ".mov",
    ".wav",
  ];

  for (const ext of binaryExtensions) {
    if (fileName.toLowerCase().endsWith(ext)) {
      return false;
    }
  }

  return true;
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

    // Parse the GitHub URL to get owner and repo
    const urlParts = githubUrl.split("/");
    const githubOwner = urlParts[3];
    const githubRepo = urlParts[4]?.replace(".git", "");

    if (!githubOwner || !githubRepo) return 0;

    // Check rate limit before making calls
    try {
      const { data: rateLimit } = await octokit.rest.rateLimit.get();
      console.log(
        `Rate limit remaining: ${rateLimit.resources.core.remaining}/${rateLimit.resources.core.limit}`,
      );

      if (rateLimit.resources.core.remaining < 20) {
        console.warn("GitHub API rate limit low! File count may be estimated.");
      }
    } catch (rateLimitError) {
      console.error("Failed to check rate limits:", rateLimitError);
    }

    // The most accurate method is to just use our manual counting function
    // which uses the same filtering logic as the actual processing
    console.log(`Counting files for ${githubUrl} on branch ${branch}`);
    const fileCount = await getFileCount(
      "",
      octokit,
      githubOwner,
      githubRepo,
      branch,
      0,
    );

    console.log(`Found ${fileCount} processable files in the repository`);
    return fileCount;
  } catch (error) {
    console.error("Error checking credits:", error);
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
