import { z } from "zod";

import { createTRPCRouter, protectedProdecure } from "../trpc";

export const qaRouter = createTRPCRouter({
  // Create a new chat with first question
  createChat: protectedProdecure
    .input(
      z.object({
        projectId: z.string(),
        question: z.string(),
        answer: z.string(),
        filesReferences: z.any(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Create both chat and first question in a transaction
      return await ctx.db.$transaction(async (tx) => {
        const chat = await tx.chat.create({
          data: {
            title: input.question.slice(0, 100), // Use first question as title
            projectId: input.projectId,
            userId: ctx.user.userId!,
          },
        });

        const question = await tx.question.create({
          data: {
            question: input.question,
            answer: input.answer.trim(), // Ensure we trim any whitespace
            filesReferences: input.filesReferences,
            projectId: input.projectId,
            userId: ctx.user.userId!,
            chatId: chat.id,
          },
        });

        return { chat, question };
      });
    }),

  // Add question to existing chat (for follow-ups)
  addFollowupQuestion: protectedProdecure
    .input(
      z.object({
        chatId: z.string(),
        question: z.string(),
        answer: z.string(),
        filesReferences: z.any(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // First check if user owns this chat
      const chat = await ctx.db.chat.findUnique({
        where: {
          id: input.chatId,
          userId: ctx.user.userId!,
        },
        select: { projectId: true },
      });

      if (!chat) {
        throw new Error("Chat not found or you don't have permission");
      }

      // Create the new question and update the chat's updatedAt timestamp
      const [question] = await ctx.db.$transaction([
        // Add the question
        ctx.db.question.create({
          data: {
            question: input.question,
            answer: input.answer,
            filesReferences: input.filesReferences,
            projectId: chat.projectId,
            userId: ctx.user.userId!,
            chatId: input.chatId,
            isFollowUp: true,
          },
        }),

        // Update the chat's updatedAt timestamp to now
        ctx.db.chat.update({
          where: { id: input.chatId },
          data: { updatedAt: new Date() },
        }),
      ]);

      return question;
    }),

  // Get chat with all its questions
  getChat: protectedProdecure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.chat.findUnique({
        where: {
          id: input.chatId,
          userId: ctx.user.userId!,
        },
        include: {
          questions: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }),

  // Get all chats for a project
  getChats: protectedProdecure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.chat.findMany({
        where: {
          projectId: input.projectId,
          userId: ctx.user.userId!,
        },
        include: {
          questions: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),
});
