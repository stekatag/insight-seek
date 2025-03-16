import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import axios from "axios";
import { z } from "zod";

import { startMeetingTranscription } from "@/lib/assembly";

const bodyParser = z.object({
  audio_url: z.string(),
  projectId: z.string(),
  meetingId: z.string(),
});

// Webrunner base URL from environment variable
const WEBRUNNER_URL = process.env.WEBRUNNER_URL;

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

    // Instead of polling, trigger a background job with Webrunner
    try {
      // Log the full URL for debugging
      const webrunnerUrl = `${WEBRUNNER_URL}/api/process-meeting-background`;
      console.log("Triggering Webrunner job at URL:", webrunnerUrl);

      // Make sure we have a valid URL before attempting the request
      if (!WEBRUNNER_URL) {
        throw new Error("WEBRUNNER_URL environment variable is not set");
      }

      const webrunnerResponse = await axios.post(
        webrunnerUrl,
        {
          transcriptId: transcriptData.id,
          meetingId,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          // Add timeout to prevent hanging requests
          timeout: 10000,
        },
      );

      console.log(
        "Successfully initiated background processing via Webrunner:",
        webrunnerResponse.status,
      );
    } catch (webrunnerError: any) {
      // Enhanced error logging
      console.error("Error triggering Webrunner job:", {
        message: webrunnerError.message,
        status: webrunnerError.response?.status,
        statusText: webrunnerError.response?.statusText,
        url: `${WEBRUNNER_URL}/api/process-meeting-background`,
        data: webrunnerError.response?.data,
      });

      // Try a fallback option if the path might be wrong
      try {
        console.log("Trying fallback URL without /api prefix...");
        const fallbackUrl = `${WEBRUNNER_URL}/process-meeting-background`;

        const fallbackResponse = await axios.post(
          fallbackUrl,
          {
            transcriptId: transcriptData.id,
            meetingId,
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: 10000,
          },
        );

        console.log("Fallback request succeeded:", fallbackResponse.status);
      } catch (fallbackError: any) {
        console.error("Fallback request also failed:", {
          message: fallbackError.message,
          status: fallbackError.response?.status,
          url: `${WEBRUNNER_URL}/process-meeting-background`,
        });

        // Even with both failures, we continue execution
      }
    }

    return NextResponse.json(
      {
        meetingId,
        transcriptId: transcriptData.id,
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
