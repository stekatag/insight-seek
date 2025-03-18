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
    console.log("Received request body:", JSON.stringify(body));

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

    // Start a detached process for background processing
    // We need to use setImmediate to ensure the response is sent before heavy processing begins
    const transcriptId = transcriptData.id;
    setImmediate(() => {
      processTranscriptionInBackground(transcriptId, meetingId)
        .then(() =>
          console.log(
            `Background processing completed for meeting ${meetingId}`,
          ),
        )
        .catch((err) =>
          console.error(
            `Background processing error for meeting ${meetingId}:`,
            err,
          ),
        );
    });

    // Return a response to the client
    return new Response(
      JSON.stringify({
        meetingId,
        transcriptionId: transcriptId,
        status: "processing",
      }),
      {
        status: 202,
        headers: { "Content-Type": "application/json" },
      },
    );
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

// This function runs in the background to poll for transcription completion
async function processTranscriptionInBackground(
  transcriptId: string,
  meetingId: string,
) {
  console.log(
    `Starting background processing for meeting ${meetingId} with transcript ${transcriptId}`,
  );

  let isCompleted = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 30; // 15 minutes (checking every 30 seconds)

  try {
    while (!isCompleted && attempts < MAX_ATTEMPTS) {
      attempts++;
      console.log(`Polling attempt ${attempts} for transcript ${transcriptId}`);

      // Wait 30 seconds between checks
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // Check transcription status
      const status = await checkTranscriptionStatus(transcriptId);
      console.log(`Transcript ${transcriptId} status: ${status.status}`);

      if (status.status === "completed") {
        console.log(
          `Transcription ${transcriptId} completed, processing results`,
        );
        isCompleted = true;

        // Process the completed transcript
        const { text, summaries } = await processCompletedTranscript(status);

        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: 950,
          chunkOverlap: 180,
        });

        // Create documents from the transcript
        const docs = await splitter.createDocuments([text]);
        console.log(`Created ${docs.length} document chunks`);

        // Get the embeddings
        const embeddings = await Promise.all(
          docs.map(async (doc, index) => {
            console.log(
              `Generating embedding for chunk ${index + 1}/${docs.length}`,
            );
            const embedding = await generateEmbedding(doc.pageContent);
            return { embedding, content: doc.pageContent };
          }),
        );

        const limit = pLimit(10);

        console.log("Saving embeddings to database");
        // Save the embeddings
        await Promise.all(
          embeddings.map(async (embedding, index) => {
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

        // Save issues/summaries with proper typing
        if (summaries.length > 0) {
          console.log(`Saving ${summaries.length} summary items`);

          // Create array of Issue objects that match the Prisma schema
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
            name:
              summaries.length > 0
                ? summaries[0]?.gist || "Untitled Meeting"
                : "Untitled Meeting",
          },
        });

        console.log("Processing completed successfully");
      } else {
        console.log(`Transcript status: ${status.status}, continuing to poll`);
      }
    }

    if (!isCompleted) {
      console.log(`Polling timed out after ${attempts} attempts`);
      await db.meeting.update({
        where: { id: meetingId },
        data: { status: "ERROR" },
      });
    }
  } catch (error) {
    console.error(
      `Error in background processing for meeting ${meetingId}:`,
      error,
    );

    // Update meeting status to ERROR
    try {
      await db.meeting.update({
        where: { id: meetingId },
        data: { status: "ERROR" },
      });
    } catch (updateError) {
      console.error(
        `Failed to update status to ERROR for meeting ${meetingId}:`,
        updateError,
      );
    }
  }
}

// Configure the function as a replacement for the Next.js API route
export const config: Config = {
  path: "/api/process-meeting",
};
