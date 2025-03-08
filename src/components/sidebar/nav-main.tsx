"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { navMainItems } from "./sidebar-data";

interface NavMainProps {
  handleNavigation: () => void;
}

export default function NavMain({ handleNavigation }: NavMainProps) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Application</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {navMainItems.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild onClick={handleNavigation}>
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
  );
}
