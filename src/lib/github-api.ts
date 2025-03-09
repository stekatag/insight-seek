import { Octokit } from "octokit";

import { getInstallationToken } from "./github-app";

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  url: string;
  htmlUrl: string;
  updatedAt: string;
  language: string | null;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
  default?: boolean;
}

/**
 * Fetches all repositories accessible to the user
 */
export async function getUserRepositories(
  userId: string,
): Promise<GitHubRepository[]> {
  const token = await getInstallationToken(userId);

  if (!token) {
    return [];
  }

  const octokit = new Octokit({ auth: token });

  try {
    // With a GitHub App installation token, we need to directly list the accessible repositories
    // We don't need to use /user/installations API which caused the 403 error
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
      per_page: 100,
    });

    // Map the repositories to our format
    const repositories = data.repositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      url: repo.url,
      htmlUrl: repo.html_url,
      updatedAt: repo.updated_at || "",
      language: repo.language,
    }));

    // Sort by name for better display
    return repositories.sort((a, b) => a.fullName.localeCompare(b.fullName));
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return [];
  }
}

/**
 * Fetches all branches for a specific repository
 */
export async function getRepositoryBranches(
  userId: string,
  repoOwner: string,
  repoName: string,
): Promise<GitHubBranch[]> {
  const token = await getInstallationToken(userId);

  if (!token) {
    return [];
  }

  const octokit = new Octokit({ auth: token });

  try {
    // Get all branches
    const { data: branches } = await octokit.rest.repos.listBranches({
      owner: repoOwner,
      repo: repoName,
      per_page: 100,
    });

    // Get default branch information
    const { data: repoInfo } = await octokit.rest.repos.get({
      owner: repoOwner,
      repo: repoName,
    });

    const defaultBranch = repoInfo.default_branch;

    // Mark the default branch
    return branches.map((branch) => ({
      ...branch,
      default: branch.name === defaultBranch,
    }));
  } catch (error) {
    console.error(
      `Error fetching branches for ${repoOwner}/${repoName}:`,
      error,
    );
    return [];
  }
}
