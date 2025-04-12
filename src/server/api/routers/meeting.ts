import { z } from "zod";

import { calculateMeetingCredits } from "@/lib/credits";

import { createTRPCRouter, protectedProdecure } from "../trpc";

export const meetingRouter = createTRPCRouter({
  // Upload a new meeting
  uploadMeeting: protectedProdecure
    .input(
      z.object({
        meetingUrl: z.string(),
        name: z.string(),
        durationMinutes: z.number().int().positive(),
        creditsToCharge: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user has enough credits
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.userId! },
        select: { credits: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      if ((user.credits || 0) < input.creditsToCharge) {
        throw new Error("Insufficient credits");
      }

      // Create meeting and deduct credits in a transaction
      const meeting = await ctx.db.$transaction(async (tx) => {
        // Deduct credits
        await tx.user.update({
          where: { id: ctx.user.userId! },
          data: { credits: { decrement: input.creditsToCharge } },
        });

        // Create the meeting, associate with user
        const meeting = await tx.meeting.create({
          data: {
            meetingUrl: input.meetingUrl,
            userId: ctx.user.userId!, // Associate with user
            name: input.name,
            status: "PROCESSING",
          },
        });

        return meeting;
      });

      return meeting;
    }),

  // Get all meetings for the current user
  getMeetings: protectedProdecure.query(async ({ ctx }) => {
    return await ctx.db.meeting.findMany({
      where: { userId: ctx.user.userId! },
      include: { issues: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Delete a meeting and its related data
  deleteMeeting: protectedProdecure
    .input(z.object({ meetingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { meetingId } = input;

      // Find the meeting by ID and ensure the user owns it
      const meeting = await ctx.db.meeting.findUnique({
        where: {
          id: meetingId,
          userId: ctx.user.userId!, // Verify ownership
        },
        select: {
          id: true,
          meetingUrl: true,
        },
      });

      if (!meeting) {
        throw new Error("Meeting not found or unauthorized");
      }

      // Use a transaction for database cleanup only - handle file deletion separately
      await ctx.db.$transaction(async (tx) => {
        // 1. First find all chats associated with this meeting
        const chats = await tx.chat.findMany({
          where: { meetingId },
          select: { id: true },
        });

        // 2. Delete all questions related to these chats
        if (chats.length > 0) {
          await tx.question.deleteMany({
            where: {
              chatId: { in: chats.map((chat) => chat.id) },
            },
          });
        }

        // 3. Delete the chats themselves
        await tx.chat.deleteMany({
          where: { meetingId },
        });

        // 4. Delete all related issues
        await tx.issue.deleteMany({
          where: { meetingId },
        });

        // 5. Delete all related meeting embeddings
        await tx.meetingEmbedding.deleteMany({
          where: { meetingId },
        });

        // 6. Delete the meeting from the database
        await tx.meeting.delete({
          where: { id: meetingId }, // Already verified ownership
        });
      });

      return { success: true, meetingUrl: meeting.meetingUrl };
    }),

  // Get a specific meeting by ID (verify ownership)
  getMeetingById: protectedProdecure
    .input(z.object({ meetingId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.meeting.findUnique({
        where: {
          id: input.meetingId,
          userId: ctx.user.userId!, // Verify ownership
        },
        include: { issues: true },
      });
    }),

  // Check credits required for a meeting
  checkMeetingCredits: protectedProdecure
    .input(
      z.object({
        durationMinutes: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const creditsNeeded = calculateMeetingCredits(input.durationMinutes);

      const user = await ctx.db.user.findUnique({
        where: { id: ctx.user.userId! },
        select: { credits: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      return {
        creditsNeeded,
        userCredits: user.credits || 0,
        hasEnoughCredits: (user.credits || 0) >= creditsNeeded,
      };
    }),
});
