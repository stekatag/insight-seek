import { db } from "@/server/db";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MeetingStatus, type Issue } from "@prisma/client";
import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import pLimit from "p-limit";
import { z } from "zod";

import {
  checkTranscriptionStatus,
  processCompletedTranscript,
  startMeetingTranscription,
  type ProcessedSummary,
} from "@/lib/assembly";
import { generateEmbedding, generateMeetingTitle } from "@/lib/gemini";

const ProcessMeetingPayloadSchema = z.object({
  meetingId: z.string(),
  meetingUrl: z.string().optional(),
  userId: z.string(),
});

export const processMeetingTask = schemaTask({
  id: "process-meeting",
  schema: ProcessMeetingPayloadSchema,
  run: async (payload, { ctx }) => {
    const { meetingId, userId } = payload;
    let { meetingUrl } = payload;

    logger.info(`🔄 Processing meeting task started.`, {
      meetingId,
      runId: ctx.run.id,
    });

    try {
      // Ensure we have the meeting URL (fetch if necessary)
      if (!meetingUrl) {
        const meeting = await db.meeting.findUnique({
          where: { id: meetingId },
          select: { meetingUrl: true },
        });
        if (!meeting?.meetingUrl) {
          throw new Error(`Meeting URL not found for meeting ID: ${meetingId}`);
        }
        meetingUrl = meeting.meetingUrl;
      }

      // 1. Update meeting to PROCESSING status
      await db.meeting.update({
        where: { id: meetingId },
        data: { status: MeetingStatus.PROCESSING },
      });
      logger.info(`Meeting status updated to PROCESSING.`, { meetingId });

      // 2. Start Transcription
      // Using a simple async call as in other v3 tasks
      const transcriptData = await startMeetingTranscription(meetingUrl);
      logger.info(
        `Transcription started with AssemblyAI ID: ${transcriptData.id}`,
        { meetingId },
      );

      // 3. Store transcript ID in our database
      await db.meeting.update({
        where: { id: meetingId },
        data: { externalId: transcriptData.id },
      });

      // 4. Poll for Transcription Completion
      logger.info(`Polling AssemblyAI for transcript completion...`, {
        meetingId,
        transcriptId: transcriptData.id,
      });
      let statusResponse;
      const pollingStartTime = Date.now();
      const POLLING_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes timeout
      const POLLING_INTERVAL_MS = 30 * 1000; // 30 seconds

      do {
        // Check for timeout
        if (Date.now() - pollingStartTime > POLLING_TIMEOUT_MS) {
          throw new Error(
            `Polling timed out after ${POLLING_TIMEOUT_MS / 60000} minutes.`,
          );
        }

        // Wait before checking status
        await new Promise((resolve) =>
          setTimeout(resolve, POLLING_INTERVAL_MS),
        );

        statusResponse = await checkTranscriptionStatus(transcriptData.id);
        logger.debug(`Transcript status: ${statusResponse.status}`, {
          meetingId,
          transcriptId: transcriptData.id,
        });
      } while (
        statusResponse.status !== "completed" &&
        statusResponse.status !== "error"
      );

      if (statusResponse.status === "error") {
        logger.error("AssemblyAI transcription failed.", {
          meetingId,
          transcriptId: transcriptData.id,
          error: statusResponse.error,
        });
        await db.meeting.update({
          where: { id: meetingId },
          data: { status: MeetingStatus.ERROR },
        });
        throw new Error(
          `Transcription failed: ${statusResponse.error || "Unknown error"}`,
        );
      }

      logger.info("Transcription completed, processing results.", {
        meetingId,
        transcriptId: transcriptData.id,
      });

      // 5. Process Completed Transcript (Get Text and Summaries/Issues)
      const { text, summaries } =
        await processCompletedTranscript(statusResponse);

      // 6. Create Document Chunks
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 950,
        chunkOverlap: 180,
      });
      const docs = await splitter.createDocuments([text || ""]); // Use empty string if text is null/undefined
      logger.info(`Created ${docs.length} document chunks.`, { meetingId });

      // 7. Generate and Save Embeddings
      if (docs.length > 0) {
        logger.info("Generating and saving embeddings...", {
          meetingId,
          count: docs.length,
        });
        const limit = pLimit(5); // Limit concurrency for embedding generation/saving
        await Promise.all(
          docs.map((doc, index) => {
            return limit(async () => {
              try {
                logger.debug(
                  `Generating embedding for chunk ${index + 1}/${docs.length}`,
                  { meetingId },
                );
                const embeddingVector = await generateEmbedding(
                  doc.pageContent,
                );

                // Create placeholder first
                const meetingEmbedding = await db.meetingEmbedding.create({
                  data: {
                    meetingId,
                    content: doc.pageContent,
                  },
                });
                // Then update with the vector using raw SQL
                await db.$executeRaw`
                        UPDATE "MeetingEmbedding"
                        SET "embedding" = ${embeddingVector}::vector
                        WHERE id = ${meetingEmbedding.id}`;
                logger.debug(`Saved embedding ${index + 1}/${docs.length}`, {
                  meetingId,
                });
              } catch (embedError) {
                logger.error(
                  `Failed to generate/save embedding for chunk ${index + 1}`,
                  { meetingId, error: embedError },
                );
                // Decide whether to throw or continue
              }
            });
          }),
        );
        logger.info(`Embeddings saved.`, { meetingId });
      } else {
        logger.warn("No document chunks generated, skipping embeddings.", {
          meetingId,
        });
      }

      // 8. Save Summaries/Issues
      if (summaries && summaries.length > 0) {
        logger.info(`Saving ${summaries.length} summary items (issues)...`, {
          meetingId,
        });
        const issueData: Omit<Issue, "id" | "createdAt" | "updatedAt">[] =
          summaries.map((summary: ProcessedSummary) => ({
            start: summary.start ?? "0", // Provide default if null
            end: summary.end ?? "0", // Provide default if null
            gist: summary.gist ?? "",
            headline: summary.headline ?? "",
            summary: summary.summary ?? "",
            meetingId,
          }));

        await db.issue.createMany({
          data: issueData,
          skipDuplicates: true, // In case processing runs again somehow
        });
        logger.info(`Issues saved.`, { meetingId });
      } else {
        logger.warn("No summaries provided by AssemblyAI, skipping issues.", {
          meetingId,
        });
      }

      // 9. Generate Meeting Title
      let meetingName = "Untitled Meeting"; // Default
      if (summaries && summaries.length > 0) {
        // Create context from summaries
        const MAX_CONTEXT_SUMMARIES = 3;
        const MAX_CONTEXT_LENGTH = 500;
        let summaryContext = "";
        for (
          let i = 0;
          i < Math.min(summaries.length, MAX_CONTEXT_SUMMARIES);
          i++
        ) {
          const headline = summaries[i]?.headline?.trim();
          const summaryText = summaries[i]?.summary?.trim();
          let nextPart = "";
          if (headline && summaryText)
            nextPart = `${headline}: ${summaryText}\n`;
          else if (headline) nextPart = `${headline}\n`;
          else if (summaryText) nextPart = `${summaryText}\n`;
          if (summaryContext.length + nextPart.length <= MAX_CONTEXT_LENGTH)
            summaryContext += nextPart;
          else break;
        }

        if (summaryContext.trim().length > 0) {
          try {
            logger.info("Generating meeting title with Gemini...", {
              meetingId,
            });
            meetingName = await generateMeetingTitle(summaryContext.trim());
          } catch (genError) {
            logger.error("Failed to generate meeting title, using default.", {
              meetingId,
              error: genError,
            });
          }
        }
      }

      // Final truncation just in case
      const MAX_NAME_LENGTH = 150;
      if (meetingName.length > MAX_NAME_LENGTH) {
        meetingName = meetingName.substring(0, MAX_NAME_LENGTH - 3) + "...";
      }

      // 10. Update Meeting Status to COMPLETED
      logger.info(
        `Updating meeting status to COMPLETED with name: ${meetingName}`,
        { meetingId },
      );
      await db.meeting.update({
        where: { id: meetingId },
        data: {
          status: MeetingStatus.COMPLETED,
          name: meetingName,
        },
      });

      logger.info("✅ Processing meeting task completed successfully.", {
        meetingId,
        runId: ctx.run.id,
      });
      return { status: "success", meetingName };
    } catch (error) {
      logger.error("❌ Error during process meeting task", {
        meetingId,
        runId: ctx.run.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Attempt to mark meeting as ERROR in DB
      try {
        await db.meeting.update({
          where: { id: meetingId },
          data: { status: MeetingStatus.ERROR },
        });
      } catch (dbError) {
        logger.error(
          "Failed to update meeting status to ERROR after catching main error.",
          { meetingId, dbError },
        );
      }
      throw error; // Re-throw to mark the task run as FAILED
    }
  },
});
