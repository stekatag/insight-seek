import { api } from "@/trpc/react";
import { useLocalStorage } from "usehooks-ts";
import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";

export default function useProject() {
  const { userId } = useAuth();
  const { data: projects, isLoading: isProjectsLoading } =
    api.project.getProjects.useQuery();

  // We'll store a mapping of user IDs to their selected project IDs
  const [projectSelections, setProjectSelections] = useLocalStorage<
    Record<string, string>
  >("insight-seek-project-selections", {});

  // Get the current user's selected project ID
  const currentProjectId = useMemo(() => {
    if (!userId) return "";
    return projectSelections[userId] || "";
  }, [userId, projectSelections]);

  // Set the current user's selected project ID
  const setProjectId = (projectId: string) => {
    if (!userId) return;
    setProjectSelections((prev) => ({
      ...prev,
      [userId]: projectId,
    }));
  };

  // Find the current project
  const project = useMemo(() => {
    if (!projects || !currentProjectId) return null;
    return projects.find((p) => p.id === currentProjectId) || null;
  }, [projects, currentProjectId]);

  return {
    projects,
    project,
    projectId: currentProjectId,
    setProjectId,
    isLoading: isProjectsLoading,
  };
}
