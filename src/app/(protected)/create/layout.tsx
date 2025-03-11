import { type Metadata } from "next";

import CreatePage from "./page";

export const metadata: Metadata = {
  title: "New Project",
};

export default function CreateProjectPageLayout() {
  return <CreatePage />;
}
