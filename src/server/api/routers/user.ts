import { createTRPCRouter, protectedProdecure } from "../trpc";

export const userRouter = createTRPCRouter({
  // Get the current user's credits
  getMyCredits: protectedProdecure.query(async ({ ctx }) => {
    return await ctx.db.user.findUnique({
      where: { id: ctx.user.userId! },
      select: { credits: true },
    });
  }),

  // Get the user's Stripe transactions
  getStripeTransactions: protectedProdecure.query(async ({ ctx }) => {
    return await ctx.db.stripeTransaction.findMany({
      where: { userId: ctx.user.userId! },
    });
  }),
});
