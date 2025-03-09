"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import useProject from "@/hooks/use-project";
import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

interface NavProjectsProps {
  handleNavigation: () => void;
}

export default function NavProjects({ handleNavigation }: NavProjectsProps) {
  const { open } = useSidebar();
  const { projects, projectId, setProjectId, isLoading } = useProject();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Your Projects</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {isLoading ? (
            // Projects loading skeleton
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <SidebarMenuItem key={`skeleton-${i}`}>
                  <div className="flex items-center gap-2 px-1">
                    <Skeleton className="size-6 shrink-0 rounded-sm" />
                    {open && <Skeleton className="h-4 w-24" />}
                  </div>
                </SidebarMenuItem>
              ))}
              {open && (
                <SidebarMenuItem className="mt-2">
                  <Skeleton className="h-8 w-32" />
                </SidebarMenuItem>
              )}
            </>
          ) : (
            // Actual projects list
            <>
              {projects?.map((project) => (
                <SidebarMenuItem key={project.name}>
                  <SidebarMenuButton
                    size={open ? "default" : "lg"}
                    className={`${!open ? "!p-0 flex justify-center" : ""}`}
                    asChild
                    onClick={() => {
                      setProjectId(project.id);
                      handleNavigation();
                    }}
                  >
                    <div>
                      <div
                        className={cn(
                          "flex size-6 items-center justify-center rounded-sm border bg-white text-sm text-primary",
                          {
                            "bg-primary text-white": project.id === projectId,
                          },
                        )}
                      >
                        {project.name.charAt(0)}
                      </div>
                      {open && <span>{project.name}</span>}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {open && (
                <SidebarMenuItem className="mt-2">
                  <Link href="/create" onClick={handleNavigation}>
                    <Button size="sm" variant="outline" className="w-fit">
                      <Plus />
                      <span>Create Project</span>
                    </Button>
                  </Link>
                </SidebarMenuItem>
              )}
            </>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
