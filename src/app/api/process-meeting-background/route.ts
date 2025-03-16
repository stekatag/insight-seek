import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { Issue } from "@prisma/client";
import pLimit from "p-limit";
import { z } from "zod";

import {
  checkTranscriptionStatus,
  processCompletedTranscript,
  type ProcessedSummary,
} from "@/lib/assembly";
import { generateEmbedding } from "@/lib/gemini";

// Define interfaces for embeddings to fix type errors
interface EmbeddingItem {
  embedding: number[];
  content: string;
}

// Validate input with required security key
const bodyParser = z.object({
  transcriptId: z.string(),
  meetingId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcriptId, meetingId } = bodyParser.parse(body);

    console.log(
      `Starting background processing for transcript ${transcriptId} and meeting ${meetingId}`,
    );

    let isCompleted = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // Higher limit for Webrunner (30 minutes checking every 30 seconds)

    while (!isCompleted && attempts < MAX_ATTEMPTS) {
      attempts++;
      console.log(
        `Background check attempt ${attempts} for transcript ${transcriptId}`,
      );

      // Wait 30 seconds between checks
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // Check transcription status - with plenty of time on Webrunner
      const status = await checkTranscriptionStatus(transcriptId);

      if (status.status === "completed") {
        console.log(
          `Transcription ${transcriptId} completed, processing results`,
        );
        isCompleted = true;

        try {
          // Process the completed transcript with proper typing
          const { text, summaries } = await processCompletedTranscript(status);

          // Create a more effective text splitter with optimal parameters
          const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 950,
            chunkOverlap: 180,
          });

          // Create documents from the transcript
          const docs = await splitter.createDocuments([text]);
          console.log(`Created ${docs.length} document chunks`);

          // Process embeddings with better error handling and retries
          const embeddings: EmbeddingItem[] = []; // Fix type here
          const limit = pLimit(3); // Limit concurrent embedding operations

          // Process embeddings in batches with retries
          for (let i = 0; i < docs.length; i++) {
            const doc = docs[i];
            if (!doc) continue; // Skip if doc is undefined

            console.log(`Processing embedding ${i + 1}/${docs.length}`);

            try {
              await limit(async () => {
                try {
                  const embedding = await generateEmbedding(doc.pageContent);
                  embeddings.push({ embedding, content: doc.pageContent });
                } catch (err) {
                  console.error(
                    `Error generating embedding, retrying with shorter content: ${err}`,
                  );

                  // Retry with shorter content
                  if (doc.pageContent.length > 500) {
                    const shortenedContent = doc.pageContent.substring(0, 500);
                    try {
                      const embedding =
                        await generateEmbedding(shortenedContent);
                      embeddings.push({ embedding, content: shortenedContent });
                    } catch (retryErr) {
                      console.error(`Retry failed: ${retryErr}`);
                    }
                  }
                }
              });
            } catch (limitErr) {
              console.error(`Limit error: ${limitErr}`);
            }

            // Add a small delay between processing to avoid rate limits
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          console.log(`Successfully generated ${embeddings.length} embeddings`);

          // Process embeddings in smaller batches to avoid transaction timeouts
          const BATCH_SIZE = 10;
          for (let i = 0; i < embeddings.length; i += BATCH_SIZE) {
            const batch = embeddings.slice(i, i + BATCH_SIZE);
            console.log(
              `Processing embedding batch ${i / BATCH_SIZE + 1}/${Math.ceil(embeddings.length / BATCH_SIZE)}`,
            );

            // Process batch
            await Promise.all(
              batch.map(async (embedding, batchIndex) => {
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

                console.log(
                  `Saved embedding ${i + batchIndex + 1}/${embeddings.length}`,
                );
              }),
            );

            // Add a delay between batches
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          // Save issues/summaries
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

          // Update meeting title based on first summary if available
          const meetingTitle = summaries[0]?.gist || "Untitled Meeting";

          // Update meeting status to completed
          await db.meeting.update({
            where: { id: meetingId },
            data: {
              status: "COMPLETED",
              name: meetingTitle,
            },
          });

          console.log(`Meeting ${meetingId} processing completed successfully`);
        } catch (processingError) {
          console.error("Error processing transcript:", processingError);

          // Update meeting status to ERROR
          await db.meeting.update({
            where: { id: meetingId },
            data: { status: "ERROR" },
          });

          return NextResponse.json(
            { error: "Processing failed", details: String(processingError) },
            { status: 500 },
          );
        }

        break; // Exit the loop once processing is complete
      } else if (status.status === "error") {
        console.error(
          `Transcript ${transcriptId} processing failed on AssemblyAI side`,
        );

        // Update meeting status to ERROR
        await db.meeting.update({
          where: { id: meetingId },
          data: { status: "ERROR" },
        });

        return NextResponse.json(
          { error: "AssemblyAI processing failed" },
          { status: 500 },
        );
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

      return NextResponse.json(
        { error: "Processing timed out" },
        { status: 408 },
      );
    }

    return NextResponse.json({ success: true, meetingId });
  } catch (error) {
    console.error("Background processing error:", error);

    try {
      // Try to update the meeting status if we have the meetingId
      const body = await req.json().catch(() => ({}));
      if (body.meetingId) {
        await db.meeting.update({
          where: { id: body.meetingId },
          data: { status: "ERROR" },
        });
      }
    } catch (updateError) {
      console.error("Failed to update meeting status:", updateError);
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
