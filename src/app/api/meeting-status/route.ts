import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const meetingId = url.searchParams.get("meetingId");

  if (!meetingId) {
    return NextResponse.json(
      { error: "Meeting ID is required" },
      { status: 400 },
    );
  }

  try {
    const meeting = await db.meeting.findUnique({
      where: {
        id: meetingId,
        project: {
          userToProjects: {
            some: {
              userId,
            },
          },
        },
      },
      select: {
        id: true,
        status: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        externalId: true,
      },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    // If the meeting is in PROCESSING status and has an externalId,
    // check with AssemblyAI if processing is actually complete
    if (meeting.status === "PROCESSING" && meeting.externalId) {
      const { checkTranscriptionStatus } = await import("@/lib/assembly");

      try {
        // Only check if it's been at least 30 seconds since last update
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
        if (meeting.updatedAt < thirtySecondsAgo) {
          console.log(`Checking status of transcript ${meeting.externalId}`);
          const transcriptStatus = await checkTranscriptionStatus(
            meeting.externalId,
          );

          if (transcriptStatus.status === "error") {
            // Update meeting status to ERROR
            await db.meeting.update({
              where: { id: meetingId },
              data: { status: "ERROR" },
            });
            meeting.status = "ERROR";
          }
        }
      } catch (checkError) {
        console.error("Error checking transcript status:", checkError);
        // Don't update status on error checking, just return current status
      }
    }

    return NextResponse.json(meeting);
  } catch (error) {
    console.error("Error fetching meeting status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
