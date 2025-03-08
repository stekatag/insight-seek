"use client";

import { useCallback } from "react";
import Image from "next/image";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

import NavLinks from "./nav-links";
import NavMain from "./nav-main";
import NavProjects from "./nav-projects";
import NavUser from "./nav-user";

export default function AppSidebar() {
  const { open, setOpen } = useSidebar();

  // Function to close sidebar on mobile when navigating
  const handleNavigation = useCallback(() => {
    // Only close the sidebar on small screens
    if (window.innerWidth < 768) {
      setOpen(false);
    }
  }, [setOpen]);

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
