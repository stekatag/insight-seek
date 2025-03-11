import { type Metadata } from "next";

import ProjectsPage from "./page";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || ""),
  title: "Projects",
};

export default function ProjectsPageLayout() {
  return <ProjectsPage />;
}
