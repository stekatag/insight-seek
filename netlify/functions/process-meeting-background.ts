import { db } from "@/server/db";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Config } from "@netlify/functions";
import type { Issue } from "@prisma/client";
import pLimit from "p-limit";
import { z } from "zod";

import {
  checkTranscriptionStatus,
  processCompletedTranscript,
  startMeetingTranscription,
  type ProcessedSummary,
} from "@/lib/assembly";
import { generateEmbedding } from "@/lib/gemini";

// Define the request body schema
const bodyParser = z.object({
  audio_url: z.string(),
  projectId: z.string(),
  meetingId: z.string(),
});

export default async (request: Request) => {
  try {
    // Parse request body
    const body = await request.json();
    const { audio_url, projectId, meetingId } = bodyParser.parse(body);

    console.log(`Processing meeting ${meetingId} for project ${projectId}`);

    // Update meeting to PROCESSING status
    await db.meeting.update({
      where: { id: meetingId },
      data: {
        status: "PROCESSING",
      },
    });

    // Use the AssemblyAI client to submit the transcription job
    const transcriptData = await startMeetingTranscription(audio_url);
    console.log(`Transcription started with ID: ${transcriptData.id}`);

    // Store transcript ID in our database
    await db.meeting.update({
      where: { id: meetingId },
      data: {
        externalId: transcriptData.id,
      },
    });

    // Return response immediately - the background processing continues
    const response = new Response(
      JSON.stringify({
        meetingId,
        transcriptionId: transcriptData.id,
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
    console.log(
      `Starting background processing for transcript ${transcriptData.id}`,
    );

    // Wait for transcription to complete
    let status;
    do {
      // Wait 30 seconds between checks
      await new Promise((resolve) => setTimeout(resolve, 30000));
      status = await checkTranscriptionStatus(transcriptData.id);
      console.log(`Transcript status: ${status.status}`);
    } while (status.status !== "completed" && status.status !== "error");

    if (status.status === "error") {
      console.error("Transcription failed");
      await db.meeting.update({
        where: { id: meetingId },
        data: { status: "ERROR" },
      });
      return response;
    }

    // Process the completed transcript
    console.log("Transcription completed, processing results");
    const { text, summaries } = await processCompletedTranscript(status);

    // Create document chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 950,
      chunkOverlap: 180,
    });
    const docs = await splitter.createDocuments([text]);
    console.log(`Created ${docs.length} document chunks`);

    // Get embeddings
    const embeddings = await Promise.all(
      docs.map(async (doc, index) => {
        console.log(
          `Generating embedding for chunk ${index + 1}/${docs.length}`,
        );
        const embedding = await generateEmbedding(doc.pageContent);
        return { embedding, content: doc.pageContent };
      }),
    );

    // Save embeddings to database
    console.log("Saving embeddings to database");
    const limit = pLimit(10);
    await Promise.all(
      embeddings.map((embedding, index) => {
        return limit(async () => {
          console.log(`Saving embedding ${index + 1}/${embeddings.length}`);
          const meetingEmbedding = await db.meetingEmbedding.create({
            data: {
              meetingId,
              content: embedding.content,
            },
          });

          await db.$executeRaw`
          UPDATE "MeetingEmbedding"
          SET "embedding" = ${embedding.embedding}::vector
          WHERE id = ${meetingEmbedding.id}`;
        });
      }),
    );

    // Save summaries to database
    if (summaries.length > 0) {
      console.log(`Saving ${summaries.length} summary items`);
      const issueData: Omit<Issue, "id" | "createdAt" | "updatedAt">[] =
        summaries.map((summary: ProcessedSummary) => ({
          start: summary.start,
          end: summary.end,
          gist: summary.gist,
          headline: summary.headline,
          summary: summary.summary,
          meetingId,
        }));

      await db.issue.createMany({
        data: issueData,
      });
    }

    // Update meeting status to completed
    console.log("Updating meeting status to COMPLETED");
    await db.meeting.update({
      where: { id: meetingId },
      data: {
        status: "COMPLETED",
        name: summaries[0]?.gist || "Untitled Meeting",
      },
    });

    console.log("Processing completed successfully");
    return response;
  } catch (error) {
    console.error("Process meeting error:", error);

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
  path: "/api/process-meeting",
};
