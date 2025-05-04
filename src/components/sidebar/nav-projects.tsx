"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";

import { cleanupProjectUrlParams, cn } from "@/lib/utils";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sort projects by creation date (newest first) and take only the first 5
  const recentProjects = projects
    ?.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 5);

  const hasMoreProjects = (projects?.length || 0) > 5;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Recent Projects</SidebarGroupLabel>
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
              {recentProjects?.map((project) => (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton
                    size={open ? "default" : "lg"}
                    className={`${!open ? "!p-0 flex justify-center" : ""}`}
                    asChild
                    onClick={() => {
                      setProjectId(project.id);
                      handleNavigation();
                      // Call the utility function
                      cleanupProjectUrlParams(router, pathname, searchParams);
                    }}
                  >
                    <div>
                      <div
                        className={cn(
                          "flex size-6 items-center justify-center rounded-sm border bg-secondary text-sm text-primary",
                          {
                            "bg-primary text-secondary":
                              project.id === projectId,
                          },
                        )}
                      >
                        {project.name.charAt(0)}
                      </div>
                      {open && <span className="truncate">{project.name}</span>}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {open && (
                <>
                  {hasMoreProjects && (
                    <SidebarMenuItem>
                      <Link
                        href="/projects"
                        onClick={() => {
                          handleNavigation();
                          // Call the utility function
                          cleanupProjectUrlParams(
                            router,
                            pathname,
                            searchParams,
                          );
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
                      >
                        <FolderKanban className="h-4 w-4" />
                        <span>View All Projects</span>
                      </Link>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem className="mt-2">
                    <Link href="/create" onClick={handleNavigation}>
                      <Button size="sm" variant="outline" className="w-fit">
                        <Plus className="h-4 w-4" />
                        <span>Create Project</span>
                      </Button>
                    </Link>
                  </SidebarMenuItem>
                </>
              )}
            </>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
