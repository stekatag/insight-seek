import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { startMeetingTranscription } from "@/lib/assembly";

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

    // Trigger the Netlify background function
    try {
      // In development, use the local Netlify Functions server
      // In production, use the Netlify Functions URL
      const isNetlify = process.env.NETLIFY === "true";
      const isDev = process.env.NODE_ENV === "development";

      let backgroundFunctionUrl;
      if (isNetlify) {
        // On Netlify, use the API path that matches our config
        backgroundFunctionUrl = "/api/process-meeting-background";
      } else if (isDev) {
        // In local dev with netlify dev, use the .netlify/functions path
        backgroundFunctionUrl =
          "/.netlify/functions/process-meeting-background";
      } else {
        // Fallback
        backgroundFunctionUrl = "/api/process-meeting-background";
      }

      // Get base URL from request
      const origin =
        req.headers.get("origin") ||
        process.env.NEXT_PUBLIC_URL ||
        "http://localhost:8888";
      const url = new URL(backgroundFunctionUrl, origin);

      console.log(`Triggering background function at: ${url.toString()}`);

      // Fire and forget - we don't wait for the response
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcriptId: transcriptData.id,
          meetingId,
        }),
      });

      if (!response.ok) {
        console.error(
          `Background function error: ${response.status} ${response.statusText}`,
        );
        const text = await response.text();
        console.error(`Response body: ${text}`);
      } else {
        console.log("Background function triggered successfully");
      }
    } catch (error) {
      console.error("Failed to trigger background function:", error);
      // We continue even if the background function trigger fails
      // The status will still show as PROCESSING
    }

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
