import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

import { commitRouter } from "./routers/commit";
import { meetingRouter } from "./routers/meeting";
import { meetingChatRouter } from "./routers/meeting-chat";
import { projectRouter } from "./routers/project";
import { qaRouter } from "./routers/qa";
import { searchRouter } from "./routers/search";
import { userRouter } from "./routers/user";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  project: projectRouter,
  commit: commitRouter,
  meeting: meetingRouter,
  qa: qaRouter,
  user: userRouter,
  search: searchRouter,
  meetingChat: meetingChatRouter,
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
