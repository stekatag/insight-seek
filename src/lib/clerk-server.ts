import "server-only";

const getClerkServerModule = () => import("@clerk/nextjs/server");

export const getClerkAuth = async () => {
  const { auth } = await getClerkServerModule();
  return auth();
};

export const getClerkClient = async () => {
  const { clerkClient } = await getClerkServerModule();
  return clerkClient();
};
