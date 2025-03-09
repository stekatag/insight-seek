import { createTRPCRouter, protectedProdecure } from "../trpc";

export const userRouter = createTRPCRouter({
  // Get the current user's credits
  getMyCredits: protectedProdecure.query(async ({ ctx }) => {
    return await ctx.db.user.findUnique({
      where: { id: ctx.user.userId! },
      select: { credits: true },
    });
  }),

  // Get the user's GitHub connection status
  getGithubStatus: protectedProdecure.query(async ({ ctx }) => {
    const userGithubToken = await ctx.db.userGitHubToken.findUnique({
      where: { userId: ctx.user.userId! },
      select: {
        token: true,
        installationId: true,
        tokenExpiresAt: true,
      },
    });

    if (!userGithubToken || !userGithubToken.installationId) {
      return {
        connected: false,
      };
    }

    // Check if token is expired
    const isExpired =
      !userGithubToken.tokenExpiresAt ||
      userGithubToken.tokenExpiresAt < new Date();

    // If token is expired but we have an installationId, we can refresh it
    return {
      connected: true,
      installationId: userGithubToken.installationId,
      tokenValid: !isExpired,
    };
  }),

  // Get the user's Stripe transactions
  getStripeTransactions: protectedProdecure.query(async ({ ctx }) => {
    return await ctx.db.stripeTransaction.findMany({
      where: { userId: ctx.user.userId! },
    });
  }),
});
