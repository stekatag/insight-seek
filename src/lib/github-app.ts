import { db } from "@/server/db";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";

/**
 * Gets a fresh installation token for a user
 */
export async function getInstallationToken(
  userId: string,
): Promise<string | null> {
  try {
    // Get the user's GitHub token
    const userToken = await db.userGitHubToken.findUnique({
      where: { userId },
      select: {
        token: true,
        installationId: true,
        tokenExpiresAt: true,
      },
    });

    // If no token or no installationId, return null
    if (!userToken || !userToken.installationId) {
      return null;
    }

    // Check if token is still valid (with 5 minute buffer)
    const isExpired =
      !userToken.tokenExpiresAt ||
      userToken.tokenExpiresAt < new Date(Date.now() + 5 * 60 * 1000);

    // If token is still valid, return it
    if (!isExpired) {
      return userToken.token;
    }

    // If token is expired, generate a new one
    console.log(`Refreshing GitHub token for user ${userId}`);
    const appAuth = createAppAuth({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
      installationId: userToken.installationId,
    });

    // Create a token with repository permissions
    const { token } = await appAuth({
      type: "installation",
      // Specify the repository permissions explicitly to avoid issues
      repositoryIds: [],
      permissions: {
        contents: "read",
        metadata: "read",
      },
    });

    // Update the token in the database
    await db.userGitHubToken.update({
      where: { userId },
      data: {
        token,
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    return token;
  } catch (error) {
    console.error("Error getting installation token:", error);
    return null;
  }
}

/**
 * Creates an Octokit instance with the user's installation token
 */
export async function createOctokitForUser(
  userId: string,
): Promise<Octokit | null> {
  const token = await getInstallationToken(userId);

  if (!token) {
    return null;
  }

  return new Octokit({ auth: token });
}
