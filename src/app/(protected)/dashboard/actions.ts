"use server";

import { db } from "@/server/db";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { createStreamableValue } from "ai/rsc";

import { generateEmbedding } from "@/lib/gemini";

interface RelevantFile {
  id?: string;
  fileName: string;
  sourceCode: string;
  summary: string;
  similarity: number;
}

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// List of common general questions about repositories
const GENERAL_QUESTIONS = [
  "what is this project",
  "what can i ask about this repo",
  "give me a brief summary of this project",
  "what are the main components",
  "what technologies does this project use",
  "how is the code organized",
  "what does this project do",
  "explain this repository",
  "what is the architecture",
  "tell me about this project",
  "what frameworks are used",
  "what is the project structure",
  "what language is this written in",
  "summarize this codebase",
  "project overview",
];

export async function askQuestion(input: string, projectId: string) {
  const stream = createStreamableValue("");

  // Normalize input for general question detection
  const normalizedInput = input.toLowerCase().trim();

  // Check if this is a general question
  const isGeneralQuestion = GENERAL_QUESTIONS.some(
    (q) =>
      normalizedInput === q ||
      normalizedInput.includes(q) ||
      q.includes(normalizedInput),
  );

  // Get project details for additional context
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { name: true, githubUrl: true, branch: true },
  });

  let context = "";
  let result: RelevantFile[] = [];

  try {
    if (isGeneralQuestion) {
      // First, use vector search to find files relevant to the specific question
      // This ensures we don't just get generic information for all general questions
      const embedding = await generateEmbedding(input);
      const vectorQuery = `[${embedding.join(",")}]`;

      const relevantFiles = (await db.$queryRaw`
        SELECT "id", "fileName", "sourceCode", "summary",
        1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) AS similarity
        FROM "SourceCodeEmbedding"
        WHERE "projectId" = ${projectId}
        ORDER BY similarity DESC
        LIMIT 15;
      `) as {
        id: string;
        fileName: string;
        sourceCode: string;
        summary: string;
        similarity: number;
      }[];

      // Keep full source code for the most relevant files (higher similarity)
      result = relevantFiles.map((file, index) => ({
        fileName: file.fileName,
        // Only include source code for the top 5 most relevant files
        sourceCode: index < 5 ? file.sourceCode : "",
        summary: file.summary,
        similarity: file.similarity,
      }));

      // 1. Get directory structure and file types
      const sourceFiles = await db.sourceCodeEmbedding.findMany({
        where: { projectId },
        select: { fileName: true },
      });

      // Count file types for statistics
      const fileTypes = new Map();
      const directories = new Map();

      sourceFiles.forEach((file) => {
        // Extract file extensions
        const extension = file.fileName.split(".").pop()?.toLowerCase();
        if (extension) {
          fileTypes.set(extension, (fileTypes.get(extension) || 0) + 1);
        }

        // Extract directories
        const pathParts = file.fileName.split("/");
        if (pathParts.length > 1) {
          const dir = pathParts[0];
          directories.set(dir, (directories.get(dir) || 0) + 1);
        }
      });

      // 2. Get recent commits for development context
      const recentCommits = await db.commit.findMany({
        where: { projectId },
        select: { commitMessage: true, commitDate: true, summary: true },
        orderBy: { commitDate: "desc" },
        take: 10,
      });

      // Build rich context that is tailored to the specific general question
      context = `Project Information:\nName: ${project?.name}\nRepository: ${project?.githubUrl}\nBranch: ${project?.branch}\n\n`;

      // Add the most relevant file summaries first (top 8)
      context += "Most Relevant Files:\n";
      relevantFiles.slice(0, 8).forEach((file, index) => {
        context += `[${index + 1}] ${file.fileName} - ${file.summary}\n`;

        // For the most relevant files, include some code snippets
        if (index < 3 && file.sourceCode) {
          // Get a short snippet (first ~300 chars) to give a taste of the code
          const codeSnippet =
            file.sourceCode.length > 300
              ? file.sourceCode.substring(0, 300) + "..."
              : file.sourceCode;
          context += `Code snippet:\n\`\`\`\n${codeSnippet}\n\`\`\`\n\n`;
        }
      });

      // Add file type statistics
      context += "\nFile Types Distribution:\n";
      [...fileTypes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([ext, count]) => {
          context += `- ${ext}: ${count} files\n`;
        });

      // Add directory structure
      context += "\nDirectory Structure:\n";
      [...directories.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .forEach(([dir, count]) => {
          context += `- ${dir}: ${count} files\n`;
        });

      // Add commit summaries for recent development context
      if (recentCommits.length > 0) {
        context += "\nRecent Development Activity:\n";
        recentCommits.forEach((commit, i) => {
          if (commit.summary) {
            const date = new Date(commit.commitDate).toLocaleDateString();
            context += `[${date}] ${commit.summary}\n`;
          }
        });
      }
    }
    // Standard code-specific question handling
    else {
      const embedding = await generateEmbedding(input);
      const vectorQuery = `[${embedding.join(",")}]`;

      result = (await db.$queryRaw`
        SELECT "fileName", "sourceCode", "summary",
        1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) AS similarity
        FROM "SourceCodeEmbedding"
        WHERE "projectId" = ${projectId}
        ORDER BY similarity DESC
        LIMIT 10;
      `) as {
        fileName: string;
        sourceCode: string;
        summary: string;
        similarity: number;
      }[];

      // Build context from the most relevant files
      for (const doc of result) {
        context += `source:${doc.fileName}\n code content:${doc.sourceCode}\n summary of file:${doc.summary}\n\n`;
      }

      // Add additional context about the project for all questions
      context += `\nProject Information: ${project?.name} (${project?.githubUrl}, branch: ${project?.branch})\n`;
    }

    // Tailor the prompt based on the specific question - even for general questions
    // Use the actual input question to ensure differentiated responses
    const promptTemplate = isGeneralQuestion
      ? `
You are a senior software architect providing a comprehensive overview of a codebase.

A developer has asked: "${input}"

Based on the following project information, provide a thorough overview that specifically answers their question:

${context}

Important instructions:
1. Focus specifically on answering "${input}" - do not provide a generic project overview
2. Provide a direct, concise, and coherent response
3. DO NOT start with phrases like "Based on the provided information" 
4. DO NOT repeat yourself or generate overlapping content
5. Structure your answer with clear headings using markdown
6. When referring to specific files or code elements, be precise
7. Include information that is most relevant to the specific question asked

Consider how "${input}" should shape your response:
- If about technologies: Focus on languages, frameworks, libraries used
- If about structure: Focus on directories, architecture, organization
- If about purpose: Focus on functionality, features, users
- If about components: Focus on modules, services, key files

Format your response as a clear, well-structured answer that provides insight specifically about what was asked.
`
      : `
You are an expert code assistant helping a developer understand specific aspects of a codebase.

The developer's question is: "${input}"

Use this code context to answer their question:

${context}

Important instructions:
1. Focus specifically on answering the question asked
2. Include relevant code snippets when helpful (using markdown code blocks)
3. Be precise and technically accurate
4. If the context doesn't contain enough information to answer completely, acknowledge this limitation
5. Format your response using markdown for readability
`;

    (async () => {
      const { textStream } = await streamText({
        model: google("gemini-2.0-flash-001"),
        prompt: promptTemplate,
        temperature: isGeneralQuestion ? 0.7 : 0.2,
      });

      for await (const delta of textStream) {
        stream.update(delta);
      }

      stream.done();
    })();
  } catch (error) {
    console.error("Error generating answer:", error);
    stream.update(
      "Sorry, I encountered an error while analyzing this repository. Please try again.",
    );
    stream.done();
  }

  return { output: stream.value, filesReferences: result };
}
