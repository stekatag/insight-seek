"use server";

import { streamText } from "ai";
import { createStreamableValue } from "ai/rsc";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateEmbedding } from "@/lib/gemini";
import { db } from "@/server/db";

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

  const result = (await db.$queryRaw`
      SELECT
    "content",
        1 - ("embedding" <=> ${vectorQuery}::vector) as similarity
      FROM "MeetingEmbedding"
      WHERE 1 - ("embedding" <=> ${vectorQuery}::vector) > .45
      AND "meetingId" = ${meetingId}
      ORDER BY similarity DESC
      LIMIT 10;
    `) as { content: string }[];
  let context = "";

  for (const r of result) {
    context += `content:${r.content}\n\n`;
  }

  (async () => {
    const { textStream } = await streamText({
      model: google("gemini-2.0-flash-001"),
      prompt: `
          AI assistant is a brand new, powerful, human-like artificial intelligence. AI will always answer in markdown syntax, with code snippets if needed.
      The traits of AI include expert knowledge, helpfulness, cleverness, and articulateness.
      AI is a well-behaved and well-mannered individual.
      AI is always friendly, kind, and inspiring, and he is eager to provide vivid and thoughtful responses to the user.
      AI has the sum of all knowledge in their brain, and is able to accurately answer nearly any question about any topic in conversation.
      START CONTEXT BLOCK
      ${context}
      END OF CONTEXT BLOCK
      AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
      If the context does not provide the answer to question, the AI assistant will say, "I'm sorry, but I don't know the answer to that question".
      AI assistant will not apologize for previous responses, but instead will indicated new information was gained.
      AI assistant will not invent anything that is not drawn directly from the context.

I am asking a question in regards to this quote in the meeting: ${quote}\n here is the question:

      START QUESTION
      ${input}
      END OF QUESTION

      AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
      If the context does not provide the answer to question, the AI assistant will say, "I'm sorry, but I don't know the answer to that question".
      AI assistant will not apologize for previous responses, but instead will indicated new information was gained.
      AI assistant will not invent anything that is not drawn directly from the context.
      Answer in markdown syntax, with code snippets if needed. Be as detailed as possible when answering, make sure there is no ambiguity and include any and all relevant information to give context to the intern.
            `,
    });

    for await (const delta of textStream) {
      stream.update(delta);
    }

    stream.done();
  })();

  return { output: stream.value };
}
