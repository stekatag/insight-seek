import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLY_AI_API_KEY! });

interface AssemblyAIChapter {
  start: number;
  end: number;
  gist?: string;
  headline?: string;
  summary?: string;
}

export interface ProcessedSummary {
  start: string;
  end: string;
  gist: string;
  headline: string;
  summary: string;
  meetingId?: string;
}

function msToTime(ms: number) {
  const seconds = ms / 1000;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export const processMeeting = async (meetingUrl: string) => {
  const transcript = await client.transcripts.transcribe({
    audio: meetingUrl,
    auto_chapters: true,
  });

  const summaries: ProcessedSummary[] =
    transcript.chapters?.map((chapter: AssemblyAIChapter) => ({
      start: msToTime(chapter.start),
      end: msToTime(chapter.end),
      gist: chapter.gist || "",
      headline: chapter.headline || "",
      summary: chapter.summary || "",
    })) || [];

  if (!transcript.text) throw new Error("No text found in the transcript");

  return {
    summaries,
    transcript,
  };
};

// Updated function to start transcription without webhooks
export async function startMeetingTranscription(audioUrl: string) {
  try {
    console.log(`Starting transcription for audio: ${audioUrl}`);

    // Create configuration for the transcript - no webhooks
    const transcriptParams = {
      audio: audioUrl,
      auto_chapters: true,
      auto_highlights: true,
    };

    console.log("Submitting transcription to AssemblyAI");

    // Submit the transcription job
    const transcriptResponse =
      await client.transcripts.submit(transcriptParams);
    console.log("Transcription submitted successfully:", transcriptResponse.id);

    return transcriptResponse;
  } catch (error) {
    console.error("Error starting transcription:", error);
    throw error;
  }
}

// Function to check transcription status
export async function checkTranscriptionStatus(transcriptId: string) {
  try {
    const transcript = await client.transcripts.get(transcriptId);
    return transcript;
  } catch (error) {
    console.error("Error checking transcription status:", error);
    throw error;
  }
}

// Function to process a completed transcript with proper types
export async function processCompletedTranscript(transcriptData: any): Promise<{
  text: string;
  summaries: ProcessedSummary[];
}> {
  // Extract chapters/summaries with proper typing
  const summaries: ProcessedSummary[] =
    transcriptData.chapters?.map((chapter: AssemblyAIChapter) => ({
      start: msToTime(chapter.start),
      end: msToTime(chapter.end),
      gist: chapter.gist || chapter.headline || "",
      headline: chapter.headline || "",
      summary: chapter.summary || "",
    })) || [];

  // Process the full transcript text, preserving all content
  let text = transcriptData.text || "";

  // If we have utterances with speakers, enhance the text with speaker information
  if (transcriptData.utterances && transcriptData.utterances.length > 0) {
    // Build an enhanced transcript with speaker labels
    const enhancedTranscript = transcriptData.utterances
      .map((utterance: any) => {
        const speaker = utterance.speaker
          ? `Speaker ${utterance.speaker}: `
          : "";
        const timestamp = `[${msToTime(utterance.start)}] `;
        return timestamp + speaker + utterance.text;
      })
      .join("\n\n");

    // Use the enhanced transcript if it's longer than the plain text
    if (enhancedTranscript.length > text.length) {
      text = enhancedTranscript;
    }
  }

  return {
    text,
    summaries,
  };
}
