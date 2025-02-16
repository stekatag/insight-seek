import { api } from "@/trpc/react";
import { useLocalStorage } from "usehooks-ts";

export default function useProject() {
  const { data: projects } = api.project.getProjects.useQuery();
  const [projectId, setProjectId] = useLocalStorage(
    "insight-seek-project-id",
    "",
  );
  const project = projects?.find((p) => p.id === projectId);

  return { projects, project, projectId, setProjectId };
}
