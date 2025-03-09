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

    // If token is still valid, verify it first with a very basic call
    // that doesn't require specific permissions and has high rate limits
    if (!isExpired) {
      try {
        const octokit = new Octokit({ auth: userToken.token });
        // Use a simple endpoint to check if the token works
        await octokit.rest.rateLimit.get();

        // If verification succeeds, return the token
        return userToken.token;
      } catch (verifyError) {
        console.log(
          "Token verification failed, will generate a new token",
          verifyError,
        );
        // Continue to refresh the token
      }
    }

    // Generate a new token
    console.log(`Refreshing GitHub token for user ${userId}`);
    try {
      // Validate installation ID format first
      const installationId = userToken.installationId;
      if (!installationId || isNaN(Number(installationId))) {
        throw new Error("Invalid installation ID");
      }

      const appAuth = createAppAuth({
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
        installationId,
      });

      // Create a token with repository permissions
      const { token } = await appAuth({
        type: "installation",
        // Specify the repository permissions explicitly
        repositoryIds: [],
        permissions: {
          contents: "read",
          metadata: "read",
        },
      });

      // Validate the new token with a simple API call
      try {
        const octokit = new Octokit({ auth: token });
        // Use a simple rate limit check instead of heavy API calls
        await octokit.rest.rateLimit.get();
      } catch (validationError) {
        console.error("New token validation failed:", validationError);
        // Log but don't throw - return the new token anyway as it might still work for some operations
        console.warn(
          "Returning potentially problematic token - will retry if needed",
        );
      }

      // Update the token in the database regardless of validation
      await db.userGitHubToken.update({
        where: { userId },
        data: {
          token,
          tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      return token;
    } catch (error: any) {
      console.error("Error refreshing GitHub token:", error);

      // Handle severe errors like installation removal
      if (
        error.message?.includes("Resource not accessible") ||
        error.message?.includes("Not found") ||
        error.message?.includes("app suspended")
      ) {
        console.log("Critical GitHub integration error - removing token");

        await db.userGitHubToken
          .delete({
            where: { userId },
          })
          .catch(() => {
            console.log("Failed to delete invalid token");
          });
      }

      return null;
    }
  } catch (error) {
    console.error("Error in getInstallationToken:", error);
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

  try {
    return new Octokit({ auth: token });
  } catch (error) {
    console.error("Error creating Octokit with token:", error);
    return null;
  }
}
