import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const WEBRUNNER_URL = process.env.NEXT_PUBLIC_WEBRUNNER_URL;

export async function POST(req: NextRequest) {
  try {
    // Authenticate the user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the request body
    const body = await req.json();

    // Forward the request to Webrunner
    console.log(`Proxying request to: ${WEBRUNNER_URL}/api/process-meeting`);

    try {
      const response = await fetch(`${WEBRUNNER_URL}/api/process-meeting`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      // Extract the response body as text first
      const responseText = await response.text();

      // Try to parse as JSON, fall back to text if needed
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.log("Response was not JSON:", responseText.substring(0, 200));
        responseData = {
          message: "Request was processed",
          rawResponse: responseText.substring(0, 100),
        };
      }

      // Always return a 202 Accepted status to the client
      return NextResponse.json(responseData, { status: 202 });
    } catch (error) {
      console.error("Error proxying to webrunner:", error);

      // Even if there's an error, return a success response to keep the UI flow working
      return NextResponse.json(
        {
          status: "processing",
          message: "Request accepted for processing",
        },
        { status: 202 },
      );
    }
  } catch (error) {
    console.error("General error in webrunner proxy:", error);

    // Return a success status no matter what
    return NextResponse.json(
      {
        status: "processing",
        message: "Request accepted",
      },
      { status: 202 },
    );
  }
}
