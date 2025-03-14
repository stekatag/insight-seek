import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import type { Issue } from "@prisma/client";
import { z } from "zod";

import {
  startMeetingTranscription,
  type ProcessedSummary,
} from "@/lib/assembly";

const bodyParser = z.object({
  audio_url: z.string(),
  projectId: z.string(),
  meetingId: z.string(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { audio_url, projectId, meetingId } = bodyParser.parse(body);

    console.log(`Processing meeting ${meetingId} for project ${projectId}`);

    // Update meeting to PROCESSING status
    await db.meeting.update({
      where: { id: meetingId },
      data: {
        status: "PROCESSING",
      },
    });

    // Use the AssemblyAI client to submit the transcription job without webhooks
    const transcriptData = await startMeetingTranscription(audio_url);

    // Store transcript ID in our database
    await db.meeting.update({
      where: { id: meetingId },
      data: {
        externalId: transcriptData.id,
      },
    });

    console.log(`Transcription started with ID: ${transcriptData.id}`);

    // Start a background process to poll for completion
    void pollTranscriptionStatus(transcriptData.id, meetingId);

    return NextResponse.json(
      {
        meetingId,
        transcriptionId: transcriptData.id,
        status: "processing",
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("Process meeting error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// This function will run in the background to poll for completion
async function pollTranscriptionStatus(
  transcriptId: string,
  meetingId: string,
) {
  const { checkTranscriptionStatus, processCompletedTranscript } = await import(
    "@/lib/assembly"
  );
  const { generateEmbedding } = await import("@/lib/gemini");
  const { RecursiveCharacterTextSplitter } = await import(
    "@langchain/textsplitters"
  );
  const pLimit = (await import("p-limit")).default;

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

      if (status.status === "completed") {
        console.log(
          `Transcription ${transcriptId} completed, processing results`,
        );
        isCompleted = true;

        // Process the completed transcript with proper typing
        const { text, summaries } = await processCompletedTranscript(status);

        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: 800,
          chunkOverlap: 130,
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

        const limit = pLimit(5);

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
            name: summaries[0]?.gist || "Untitled Meeting",
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
    console.error("Error in polling:", error);

    // Update meeting status to ERROR
    try {
      await db.meeting.update({
        where: { id: meetingId },
        data: { status: "ERROR" },
      });
    } catch (updateError) {
      console.error("Failed to update meeting status:", updateError);
    }
  }
}
