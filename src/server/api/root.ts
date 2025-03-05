import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { projectRouter } from "./routers/project";
import { commitsRouter } from "./routers/commits";
import { meetingsRouter } from "./routers/meetings";
import { qaRouter } from "./routers/qa";
import { userRouter } from "./routers/user";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  project: projectRouter,
  commits: commitsRouter,
  meetings: meetingsRouter,
  qa: qaRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
