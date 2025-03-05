import { z } from "zod";
import { createTRPCRouter, protectedProdecure } from "../trpc";
import { pullCommits } from "@/lib/github";

export const commitRouter = createTRPCRouter({
  // Get commits for a project
  getCommits: protectedProdecure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Start commits pull in the background without waiting for it
      pullCommits(input.projectId).catch((err) =>
        console.error(`Background commit pull failed: ${err}`),
      );

      // Immediately return existing commits
      return await ctx.db.commit.findMany({
        where: { projectId: input.projectId },
        orderBy: { commitDate: "desc" },
      });
    }),
});
