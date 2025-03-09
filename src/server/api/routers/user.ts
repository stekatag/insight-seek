import { TRPCError } from "@trpc/server";

import { verifyGitHubToken } from "@/lib/github-api";

import { createTRPCRouter, protectedProdecure } from "../trpc";

export const userRouter = createTRPCRouter({
  // Get the current user's credits
  getMyCredits: protectedProdecure.query(async ({ ctx }) => {
    return await ctx.db.user.findUnique({
      where: { id: ctx.user.userId! },
      select: { credits: true },
    });
  }),

  // Get the user's GitHub connection status with verification
  getGithubStatus: protectedProdecure.query(async ({ ctx }) => {
    const userId = ctx.user.userId!;

    // Count projects along with GitHub status for better context
    const [userGithubToken, projectCount] = await Promise.all([
      ctx.db.userGitHubToken.findUnique({
        where: { userId },
        select: {
          token: true,
          installationId: true,
          tokenExpiresAt: true,
          username: true,
        },
      }),
      ctx.db.userToProject.count({
        where: {
          userId,
          project: {
            deletedAt: null,
          },
        },
      }),
    ]);

    if (!userGithubToken || !userGithubToken.installationId) {
      return {
        connected: false,
        projectCount,
      };
    }

    // Check if token is expired based on our stored expiration
    const isExpired =
      !userGithubToken.tokenExpiresAt ||
      userGithubToken.tokenExpiresAt < new Date();

    // Return basic info without making an API call
    return {
      connected: true,
      installationId: userGithubToken.installationId,
      username: userGithubToken.username,
      tokenValid: !isExpired,
      projectCount,
    };
  }),

  // Change to a mutation for better error handling
  verifyGithubToken: protectedProdecure.mutation(async ({ ctx }) => {
    const userId = ctx.user.userId!;

    try {
      console.log(`Verifying GitHub token for user ${userId}`);
      const result = await verifyGitHubToken(userId);
      console.log(`Verification result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      console.error("Error in verifyGithubToken procedure:", error);

      // Convert to a standard error format
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to verify GitHub connection",
      });
    }
  }),

  // Remove GitHub token
  removeGithubToken: protectedProdecure.mutation(async ({ ctx }) => {
    const userId = ctx.user.userId!;

    try {
      await ctx.db.userGitHubToken.delete({
        where: { userId },
      });

      return { success: true };
    } catch (error) {
      console.error("Error removing GitHub token:", error);
      return { success: false, error: "Failed to remove GitHub connection" };
    }
  }),

  // Get the user's Stripe transactions
  getStripeTransactions: protectedProdecure.query(async ({ ctx }) => {
    return await ctx.db.stripeTransaction.findMany({
      where: { userId: ctx.user.userId! },
    });
  }),
});
