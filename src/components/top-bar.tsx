"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchBar } from "@/components/search-bar";
import UserDropdown from "@/components/user-dropdown";

import { ToggleTheme } from "./toggle-theme";

export default function TopBar() {
  return (
    <div className="sticky top-0 z-10 bg-background p-2 pb-0 mb-1">
      <div className="flex items-center gap-3 rounded-md border border-sidebar-border bg-sidebar px-4 py-2 shadow">
        <SidebarTrigger />
        <SearchBar />
        <div className="ml-auto flex gap-4 items-center">
          <ToggleTheme />
          <UserDropdown
            className="p-0"
            variant="icon"
            align="end"
            side="bottom"
          />
        </div>
      </div>
    </div>
  );
}
