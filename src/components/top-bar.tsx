import { UserButton } from "@clerk/nextjs";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchBar } from "@/components/search-bar";

export default function TopBar() {
  return (
    <div className="sticky top-0 z-10 bg-background p-2 pb-0">
      <div className="flex items-center gap-3 rounded-md border border-sidebar-border bg-sidebar px-4 py-2 shadow">
        <SidebarTrigger />
        <SearchBar />
        <div className="ml-auto">
          <UserButton />
        </div>
      </div>
    </div>
  );
}
