import { formatTechnicalText } from "@/lib/utils";
import { Project } from "@prisma/client";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

// Add this function to your dashboard page component
function formatProjectUrl(url: string | null | undefined): React.ReactNode {
  if (!url) return null;

  try {
    // Add zero-width spaces to make the URL breakable at logical points
    // This preserves the exact URL format while allowing browser wrapping
    return (
      <span className="inline-block max-w-full break-all">
        {
          url
            .replace(/\/\//g, "//\u200B") // After protocol
            .replace(/\//g, "/\u200B") // After each slash
            .replace(/\./g, ".\u200B") // After each dot
            .replace(/\-/g, "-\u200B") // After each dash
        }
      </span>
    );
  } catch (e) {
    // Fallback to formatting utility
    return formatTechnicalText(url || "");
  }
}

export default function ProjectUrl({ project }: { project: Project }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 gap-y-1 text-sm text-muted-foreground">
      <Link
        href={project.githubUrl ?? ""}
        className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 sm:flex-row sm:items-center"
        target="_blank"
        title={project.githubUrl}
      >
        <GitHubLogoIcon className="h-5 w-5 sm:h-4 sm:w-4" />
        <div className="flex flex-col gap-1 text-sm sm:flex-row">
          <span>This project is linked to</span>
          <span className="border-primary/50 sm:border-b">
            {formatProjectUrl(project.githubUrl)}
          </span>
        </div>
        <ExternalLink className="h-4 w-4" />
      </Link>
    </div>
  );
}
