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

import { navLinkItems } from "./sidebar-data";

interface NavLinksProps {
  handleNavigation: () => void;
}

export default function NavLinks({ handleNavigation }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {navLinkItems.map((item) => (
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
