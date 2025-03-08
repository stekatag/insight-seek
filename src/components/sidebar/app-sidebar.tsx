"use client";

import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import ApplicationLogo from "../application-logo";
import NavLinks from "./nav-links";
import NavMain from "./nav-main";
import NavProjects from "./nav-projects";
import NavUser from "./nav-user";

export default function AppSidebar() {
  const { setOpenMobile, isMobile } = useSidebar();

  // Function to close sidebar on mobile when navigating
  const handleNavigation = () => {
    // Only close the sidebar on small screens
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <ApplicationLogo className="p-1.5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">InsightSeek</span>
                  <span className="truncate text-xs">Dashboard</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain handleNavigation={handleNavigation} />
        <NavProjects handleNavigation={handleNavigation} />
        <div className="mt-auto">
          <NavLinks handleNavigation={handleNavigation} />
          <NavUser handleNavigation={handleNavigation} />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
