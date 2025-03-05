"use client";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import useProject from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import {
  Bot,
  CreditCard,
  LayoutDashboard,
  Plus,
  Presentation,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Q&A",
    url: "/qa",
    icon: Bot,
  },
  {
    title: "Meetings",
    url: "/meetings",
    icon: Presentation,
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCard,
  },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const { open } = useSidebar();
  const { projects, projectId, setProjectId, isLoading } = useProject();

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" width={40} height={40} alt="logo" />
          {open && (
            <h1 className="text-xl font-bold text-primary/80">InsightSeek</h1>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url}
                      className={cn({
                        "!bg-primary !text-white": pathname === item.url,
                      })}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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
                      <SidebarMenuButton asChild>
                        <div onClick={() => setProjectId(project.id)}>
                          <div
                            className={cn(
                              "flex size-6 items-center justify-center rounded-sm border bg-white text-sm text-primary",
                              {
                                "bg-primary text-white":
                                  project.id === projectId,
                              },
                              {
                                "size-5 p-2": !open,
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
                      <Link href="/create">
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
      </SidebarContent>
    </Sidebar>
  );
}
