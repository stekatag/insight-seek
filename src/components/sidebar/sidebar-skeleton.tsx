import { Skeleton } from "@/components/ui/skeleton";

export default function SidebarSkeleton() {
  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-72 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        {/* Logo Placeholder */}
        <Skeleton className="h-6 w-32" />
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Nav Item Skeletons */}
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="space-y-2 pt-4">
          <Skeleton className="mb-2 h-4 w-20" /> {/* Section Title */}
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </nav>
      <div className="mt-auto border-t border-sidebar-border p-4">
        {/* User/Footer Placeholder */}
        <Skeleton className="h-10 w-full" />
      </div>
    </aside>
  );
}
