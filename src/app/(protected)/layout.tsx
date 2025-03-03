import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { UserButton } from "@clerk/nextjs";
import AppSidebar from "./app-sidebar";

type Props = {
  children: React.ReactNode;
};

export default function SidebarLayout({ children }: Props) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="m-2 w-full">
        <div className="flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar px-4 py-2 shadow">
          <SidebarTrigger />
          {/* <SearchBar/> */}
          <div className="ml-auto"></div>
          <UserButton />
        </div>
        <div className="h-4"></div>
        {/* main content */}
        <div className="rounde-md min-h-[calc(100vh-6rem)] rounded-md border border-sidebar-border bg-sidebar p-4 shadow">
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}
