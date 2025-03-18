import { z } from "zod";

import { pullCommits } from "@/lib/github";

import { createTRPCRouter, protectedProdecure } from "../trpc";

export const commitRouter = createTRPCRouter({
  // Get commits for a project
  getCommits: protectedProdecure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check for commits that need to be loaded
      const existingCommits = await ctx.db.commit.findMany({
        where: { projectId: input.projectId },
        orderBy: { commitDate: "desc" },
      });

      // If we have no commits or it's been more than 10 minutes since last check
      // trigger a background update
      const shouldRefresh =
        existingCommits.length === 0 ||
        (existingCommits.length > 0 &&
          Date.now() - (existingCommits[0]?.updatedAt?.getTime() ?? 0) >
            10 * 60 * 1000);

      if (shouldRefresh) {
        // Start commits pull in the background without waiting for it
        void pullCommits(input.projectId).catch((err) =>
          console.error(`Background commit pull failed: ${err}`),
        );
      }

      // Immediately return existing commits
      return existingCommits;
    }),
});
