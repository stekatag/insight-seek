"use server";

import { db } from "@/server/db";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { createStreamableValue } from "ai/rsc";

import { generateEmbedding } from "@/lib/gemini";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function askMeeting(
  input: string,
  quote: string,
  meetingId: string,
) {
  const stream = createStreamableValue("");

  const embedding = await generateEmbedding(input);
  const vectorQuery = `[${embedding.join(",")}]`;

  // Get comprehensive meeting information for additional context
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    select: {
      name: true,
      createdAt: true,
      issues: {
        select: {
          id: true,
          start: true,
          end: true,
          gist: true,
          headline: true,
          summary: true,
        },
        orderBy: {
          start: "asc",
        },
      },
    },
  });

  if (!meeting) {
    throw new Error("Meeting not found");
  }

  // Analyze the user's query more comprehensively
  const normalizedInput = input.toLowerCase().trim();

  // Define query characteristics to look for
  const queryPatterns = {
    // Summary/overview patterns
    summaryPatterns: [
      "summary",
      "summarize",
      "overview",
      "recap",
      "brief",
      "tell me about the meeting",
      "what happened",
      "what was discussed",
    ],
    // Decision patterns
    decisionPatterns: [
      "decision",
      "decide",
      "agreed",
      "conclusion",
      "agreement",
      "outcome",
    ],
    // Action item patterns
    actionPatterns: [
      "action",
      "task",
      "todo",
      "to-do",
      "to do",
      "assign",
      "responsibility",
      "responsible",
      "follow up",
    ],
    // Specific detail patterns
    specificPatterns: [
      "how",
      "why",
      "when",
      "who said",
      "explain",
      "detail",
      "elaborate",
    ],
    // Brevity indicators
    brevityPatterns: [
      "brief",
      "short",
      "concise",
      "quick",
      "briefly",
      "in short",
    ],
    // Comprehensive indicators
    comprehensivePatterns: [
      "detail",
      "comprehensive",
      "thorough",
      "complete",
      "in-depth",
      "everything",
      "all about",
    ],
  };

  // Function to check how many patterns match
  const matchCount = (patterns: string[]) => {
    return patterns.filter((pattern) => normalizedInput.includes(pattern))
      .length;
  };

  // Calculate different query characteristics
  const summaryScore = matchCount(queryPatterns.summaryPatterns);
  const decisionScore = matchCount(queryPatterns.decisionPatterns);
  const actionScore = matchCount(queryPatterns.actionPatterns);
  const specificScore = matchCount(queryPatterns.specificPatterns);
  const brevityScore = matchCount(queryPatterns.brevityPatterns);
  const comprehensiveScore = matchCount(queryPatterns.comprehensivePatterns);

  // Derive query characteristics
  const isGeneralQuestion = summaryScore > 0;
  const isDecisionQuestion = decisionScore > 0;
  const isActionItemQuestion = actionScore > 0;
  const isSpecificQuestion = specificScore > 1; // Require multiple specific indicators
  const wantsBriefResponse = brevityScore > 0;
  const wantsDetailedResponse = comprehensiveScore > 0;

  // Determine if this requires chronological ordering
  // General summaries and action items/decisions benefit from chronological ordering
  const needsChronologicalOrdering =
    isGeneralQuestion || isDecisionQuestion || isActionItemQuestion;

  // Calculate how many results we need based on query characteristics
  let requiredWidth: number;

  if (isGeneralQuestion) {
    // General summaries need more context, unless brevity is requested
    requiredWidth = wantsBriefResponse ? 30 : 75;
  } else if (isDecisionQuestion || isActionItemQuestion) {
    // Decision/action questions need moderate context
    requiredWidth = 50;
  } else if (isSpecificQuestion) {
    // Specific questions need focused context
    requiredWidth = 20;
  } else {
    // Default for other question types
    requiredWidth = 25;
  }

  // Adjust for explicit requests for detail/brevity
  if (wantsDetailedResponse) requiredWidth = Math.max(requiredWidth, 60);
  if (wantsBriefResponse) requiredWidth = Math.min(requiredWidth, 30);

  // Minimum similarity threshold based on query type
  // More specific questions need higher relevance
  const similarityThreshold = isSpecificQuestion
    ? 0.5
    : isDecisionQuestion || isActionItemQuestion
      ? 0.35
      : 0.2;

  console.log(
    `Query analysis: general=${isGeneralQuestion}, decision=${isDecisionQuestion}, action=${isActionItemQuestion}, specific=${isSpecificQuestion}`,
  );
  console.log(
    `Using width=${requiredWidth}, similarity=${similarityThreshold}, chronological=${needsChronologicalOrdering}`,
  );

  // Execute appropriate SQL query based on characteristics
  let orderedResults;

  try {
    if (needsChronologicalOrdering) {
      // For questions that benefit from chronological ordering, get chronological results
      // but still filter by minimum similarity for relevance
      const result = await db.$queryRaw`
        SELECT
          "id", "content",
          1 - ("embedding" <=> ${vectorQuery}::vector) as similarity
        FROM "MeetingEmbedding"
        WHERE "meetingId" = ${meetingId}
        AND 1 - ("embedding" <=> ${vectorQuery}::vector) > ${similarityThreshold}
        ORDER BY "id" ASC
        LIMIT ${requiredWidth}
      `;
      orderedResults = result as {
        id: string;
        content: string;
        similarity: number;
      }[];
      console.log(
        `Executed chronological query with width=${requiredWidth}, got ${orderedResults.length} results`,
      );
    } else {
      // For specific questions, prioritize semantic relevance
      const result = await db.$queryRaw`
        SELECT
          "id", "content",
          1 - ("embedding" <=> ${vectorQuery}::vector) as similarity
        FROM "MeetingEmbedding"
        WHERE "meetingId" = ${meetingId}
        AND 1 - ("embedding" <=> ${vectorQuery}::vector) > ${similarityThreshold}
        ORDER BY similarity DESC
        LIMIT ${requiredWidth}
      `;
      orderedResults = result as {
        id: string;
        content: string;
        similarity: number;
      }[];
      console.log(
        `Executed semantic query with width=${requiredWidth}, got ${orderedResults.length} results`,
      );
    }

    // If we didn't get enough results, try a fallback query with lower similarity threshold
    if (orderedResults.length < 5 && similarityThreshold > 0.2) {
      console.log(
        "Not enough results, trying fallback query with lower threshold",
      );
      const fallbackResult = await db.$queryRaw`
        SELECT
          "id", "content",
          1 - ("embedding" <=> ${vectorQuery}::vector) as similarity
        FROM "MeetingEmbedding"
        WHERE "meetingId" = ${meetingId}
        ORDER BY similarity DESC
        LIMIT 15
      `;
      orderedResults = fallbackResult as {
        id: string;
        content: string;
        similarity: number;
      }[];
      console.log(`Fallback query returned ${orderedResults.length} results`);
    }

    // If we need chronological order and results came from similarity search,
    // attempt to re-order by timestamp
    if (needsChronologicalOrdering) {
      orderedResults = orderedResults.sort((a, b) => {
        try {
          // Extract timestamps if present in format [HH:MM:SS]
          const timeRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/;
          const timeA = a.content.match(timeRegex)?.[1] || "";
          const timeB = b.content.match(timeRegex)?.[1] || "";

          if (timeA && timeB) {
            return timeA.localeCompare(timeB);
          }

          // If no timestamps, try to sort by ID (which might correlate with sequence)
          return a.id.localeCompare(b.id);
        } catch (error) {
          console.error("Error during timestamp sorting:", error);
          return 0;
        }
      });
      console.log("Re-ordered results chronologically");
    }
  } catch (error) {
    console.error("Error executing embedding query:", error);
    // Fallback to basic query if the advanced one fails
    const fallbackResult = await db.$queryRaw`
      SELECT "id", "content"
      FROM "MeetingEmbedding" 
      WHERE "meetingId" = ${meetingId}
      ORDER BY "id" ASC
      LIMIT 15
    `;
    orderedResults = fallbackResult as {
      id: string;
      content: string;
      similarity: number;
    }[];
    console.log(
      `Used emergency fallback query, got ${orderedResults.length} results`,
    );
  }

  // Build rich context for the AI
  let context = "";

  // 1. Meeting Overview
  context += `## MEETING OVERVIEW\n`;
  context += `Meeting Title: ${meeting.name}\n`;
  context += `Date: ${meeting.createdAt.toLocaleDateString()}\n\n`;

  // 2. Issues Section - Add identified issues
  if (meeting.issues.length > 0) {
    context += `## KEY ISSUES IDENTIFIED (${meeting.issues.length} total)\n\n`;

    // For brevity requests, summarize issues
    if (wantsBriefResponse && meeting.issues.length > 3) {
      context += meeting.issues
        .slice(0, 3)
        .map(
          (issue, i) =>
            `### ISSUE ${i + 1}: ${issue.gist}\n` +
            `Timeframe: ${issue.start} - ${issue.end}\n` +
            `Summary: ${issue.summary}\n\n`,
        )
        .join("");
      context += `...and ${meeting.issues.length - 3} more issues...\n\n`;
    } else {
      // Otherwise include all issues
      meeting.issues.forEach((issue, i) => {
        context += `### ISSUE ${i + 1}: ${issue.gist}\n`;
        context += `Timeframe: ${issue.start} - ${issue.end}\n`;
        context += `Headline: ${issue.headline}\n`;
        context += `Summary: ${issue.summary}\n\n`;
      });
    }
  }

  // 3. Transcript Section - with smart formatting based on query type
  if (orderedResults.length > 0) {
    context += `## MEETING TRANSCRIPT (EXCERPTS)\n\n`;

    // For brevity requests, just show the most relevant segments
    const segmentsToInclude = wantsBriefResponse
      ? Math.min(10, orderedResults.length)
      : orderedResults.length;

    orderedResults.slice(0, segmentsToInclude).forEach((chunk, i) => {
      // Extract and show timing information if present
      const timeMatch = chunk.content.match(/\[(.*?)\]/);
      const timeInfo = timeMatch ? timeMatch[0] : `Segment ${i + 1}`;
      context += `### ${timeInfo}\n${chunk.content.trim()}\n\n`;
    });

    if (wantsBriefResponse && orderedResults.length > segmentsToInclude) {
      context += `...additional segments omitted for brevity...\n\n`;
    }
  }

  // 4. Follow-up context for quotes
  if (quote && !isGeneralQuestion) {
    context += `## SPECIFIC CONTEXT FOR THIS QUESTION\n${quote}\n\n`;
  }

  // 5. Analysis resources metadata
  context += `## ANALYSIS RESOURCES\n`;
  context += `- Number of identified issues: ${meeting.issues.length}\n`;
  context += `- Number of transcript segments included: ${orderedResults.length}\n`;
  context += `- Meeting query type: ${
    isGeneralQuestion
      ? "General overview"
      : isDecisionQuestion
        ? "Decision analysis"
        : isActionItemQuestion
          ? "Action item analysis"
          : isSpecificQuestion
            ? "Specific detail question"
            : "Other question type"
  }\n`;
  context += `- Brevity requested: ${wantsBriefResponse ? "Yes" : "No"}\n`;
  context += `- Detailed analysis requested: ${wantsDetailedResponse ? "Yes" : "No"}\n`;

  // Create a unified but more intelligent adaptive prompt
  const promptTemplate = `
  You are an expert meeting analyst with exceptional ability to understand and answer questions about meetings.
  
  USER QUESTION: "${input}"
  
  MEETING CONTEXT:
  
  ${context}
  
  ADVANCED RESPONSE GUIDELINES:
  
  1. QUESTION ANALYSIS: This appears to be a ${
    isGeneralQuestion
      ? "general overview question"
      : isDecisionQuestion
        ? "question about decisions made"
        : isActionItemQuestion
          ? "question about action items"
          : isSpecificQuestion
            ? "specific detailed question"
            : "specialized question"
  }${wantsBriefResponse ? " with a request for brevity" : ""}${wantsDetailedResponse ? " with a request for detailed analysis" : ""}.
  
  2. CONTENT GUIDELINES:
  ${
    isGeneralQuestion
      ? "- Provide a well-structured overview of the entire meeting\n" +
        "- Include key topics, decisions, and action items\n" +
        "- Organize information chronologically or by topic areas\n" +
        "- Use clear section headings and bullet points"
      : ""
  }
  ${
    isDecisionQuestion
      ? "- Focus specifically on all decisions made during the meeting\n" +
        "- For each decision, include: what was decided, who was involved, and any context\n" +
        "- If possible, note when in the meeting each decision occurred\n" +
        "- Clearly distinguish between definite decisions and tentative conclusions"
      : ""
  }
  ${
    isActionItemQuestion
      ? "- List all tasks, assignments, and follow-up items\n" +
        "- For each action item, include: what needs to be done, who is responsible, and deadlines if specified\n" +
        "- Organize by responsibility or by timeline\n" +
        "- Be explicit about any unclear or undefined action items"
      : ""
  }
  ${
    isSpecificQuestion &&
    !isGeneralQuestion &&
    !isDecisionQuestion &&
    !isActionItemQuestion
      ? "- Focus narrowly on answering the specific question asked\n" +
        "- Provide direct evidence from the transcript to support your answer\n" +
        "- Be precise and avoid tangential information\n" +
        "- Acknowledge limitations in the available information if relevant"
      : ""
  }
  
  3. FORMAT AND LENGTH:
  ${
    wantsBriefResponse
      ? "- Be concise and direct - the user has explicitly requested brevity\n" +
        "- Use bullet points and short paragraphs\n" +
        "- Focus only on the most important information\n" +
        "- Aim for clarity over comprehensiveness"
      : wantsDetailedResponse
        ? "- Be comprehensive and thorough - the user wants detailed information\n" +
          "- Include all relevant context and nuance\n" +
          "- Use proper formatting with sections, subsections, and emphasis\n" +
          "- Don't omit any significant details"
        : "- Balance detail with clarity\n" +
          "- Use appropriate length for the type of question\n" +
          "- Format for readability with proper headings and structure"
  }
  
  4. ADDITIONAL INSTRUCTIONS:
  - Reference specific timestamps or speakers when relevant
  - Use markdown formatting for better readability
  - If information appears to be missing, acknowledge the limitation
  - Focus on factual information rather than subjective interpretation
  - Directly respond to what was asked - don't provide general meeting summaries for specific questions

  REMEMBER: Your primary goal is to provide the most helpful, accurate answer to the specific question asked, customizing your response format and detail level accordingly.
  `;

  // Adjust temperature based on query characteristics
  const temperature = isGeneralQuestion
    ? 0.5 // Higher creativity for summaries
    : wantsBriefResponse
      ? 0.3 // Lower for brevity (more focused)
      : wantsDetailedResponse
        ? 0.4 // Balanced for detailed responses
        : 0.2; // Very focused for specific questions

  (async () => {
    const { textStream } = await streamText({
      model: google("gemini-2.0-flash-001"),
      prompt: promptTemplate,
      temperature,
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }

    stream.done();
  })();

  return { output: stream.value };
}
