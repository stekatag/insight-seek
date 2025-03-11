import { type Metadata } from "next";

import ProjectsPage from "./page";

export const metadata: Metadata = {
  title: "Projects",
};

export default function ProjectsPageLayout() {
  return <ProjectsPage />;
}
