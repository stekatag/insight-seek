import { db } from "@/server/db";
import type { Context } from "@netlify/functions";
import type { Issue } from "@prisma/client";

import type { ProcessedSummary } from "@/lib/assembly";

export default async (request: Request, context: Context) => {
  console.time("Meeting Processing Time");
  try {
    const body = await request.json();
    const { transcriptId, meetingId } = body;

    console.log(
      `Background function processing meeting: ${meetingId} with transcript ID: ${transcriptId}`,
    );

    // Import dependencies inside the function to reduce cold start time
    const { checkTranscriptionStatus, processCompletedTranscript } =
      await import("@/lib/assembly");
    const { generateEmbedding } = await import("@/lib/gemini");
    const { RecursiveCharacterTextSplitter } = await import(
      "@langchain/textsplitters"
    );
    const pLimit = (await import("p-limit")).default;

    let isCompleted = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 15 minutes (checking every 30 seconds)

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

    console.timeEnd("Meeting Processing Time");

    return new Response(
      JSON.stringify({
        status: "success",
        message: "Meeting processing completed",
      }),
    );
  } catch (error) {
    console.error("Error in background function:", error);

    // Try to update meeting status to ERROR if possible
    try {
      const { meetingId } = await request.json();
      await db.meeting.update({
        where: { id: meetingId },
        data: { status: "ERROR" },
      });
    } catch (updateError) {
      console.error("Failed to update meeting status:", updateError);
    }

    console.timeEnd("Meeting Processing Time");

    return new Response(
      JSON.stringify({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
};
