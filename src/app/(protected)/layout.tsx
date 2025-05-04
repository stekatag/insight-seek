import { Suspense } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/sidebar/app-sidebar";
import SidebarSkeleton from "@/components/sidebar/sidebar-skeleton";
import TopBar from "@/components/top-bar";

type Props = {
  children: React.ReactNode;
};

export default function SidebarLayout({ children }: Props) {
  return (
    <SidebarProvider>
      <Suspense fallback={<SidebarSkeleton />}>
        <AppSidebar />
      </Suspense>
      <main className="flex w-full flex-col">
        <TopBar />
        {/* main content */}
        <div className="m-2 min-h-[calc(100vh-5.25rem)] rounded-md border border-sidebar-border bg-sidebar p-4 shadow">
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}
