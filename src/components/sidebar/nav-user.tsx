"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import UserDropdown from "@/components/user-dropdown";

interface NavUserProps {
  handleNavigation: () => void;
}

export default function NavUser({ handleNavigation }: NavUserProps) {
  // Get sidebar open state to determine if it's collapsed
  const { open, isMobile } = useSidebar();

  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupLabel>Account</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserDropdown
              variant="full"
              onNavigate={handleNavigation}
              side={isMobile ? "top" : "right"}
              isCollapsed={!open}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
