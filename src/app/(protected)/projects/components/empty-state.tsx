import React from "react";
import { FolderIcon, PanelTopIcon, SearchIcon } from "lucide-react";

type EmptyStateIcon = "folder" | "search" | "panel" | "custom";

interface EmptyStateProps {
  title: string;
  description: string;
  icon: EmptyStateIcon;
  customIcon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({
  title,
  description,
  icon,
  customIcon,
  action,
}: EmptyStateProps) {
  const renderIcon = () => {
    switch (icon) {
      case "folder":
        return <FolderIcon className="h-10 w-10 text-muted-foreground/50" />;
      case "search":
        return <SearchIcon className="h-12 w-12 text-muted-foreground/50" />;
      case "panel":
        return <PanelTopIcon className="h-12 w-12 text-muted-foreground/50" />;
      case "custom":
        return customIcon;
      default:
        return <FolderIcon className="h-12 w-12 text-muted-foreground/50" />;
    }
  };

  return (
    <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
      <div className="rounded-full bg-muted p-3">{renderIcon()}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
