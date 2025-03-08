"use client";

import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  ChevronsUpDown,
  CreditCard,
  LogOut,
  PlusCircle,
  User,
} from "lucide-react";

import { api } from "@/trpc/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

interface NavUserProps {
  handleNavigation: () => void;
}

export default function NavUser({ handleNavigation }: NavUserProps) {
  const { open } = useSidebar();
  const { user, isLoaded } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const isMobile = useIsMobile();

  const { data: userData, isLoading: isLoadingUser } =
    api.user.getMyCredits.useQuery(undefined, {
      enabled: isLoaded && !!user,
      staleTime: 0,
    });

  // Extract credits correctly
  const credits = userData?.credits ?? null;

  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupLabel>Account</SidebarGroupLabel>
      <SidebarGroupContent>
        {/* User Account Dropdown */}
        <SidebarMenu>
          <SidebarMenuItem>
            {isLoaded && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-8 ">
                      <AvatarImage
                        src={user.imageUrl}
                        alt={user.firstName || "User"}
                      />
                      <AvatarFallback>
                        {user.firstName?.charAt(0) ||
                          user.emailAddresses[0]?.emailAddress?.charAt(0) ||
                          "U"}
                      </AvatarFallback>
                    </Avatar>
                    {open && (
                      <>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                          <span className="truncate font-semibold">
                            {user.fullName || user.firstName || "User"}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {isLoadingUser
                              ? "Loading..."
                              : `${credits ?? 0} credits`}
                          </span>
                        </div>
                        <ChevronsUpDown className="ml-auto size-4 opacity-60" />
                      </>
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="min-w-56"
                  side={isMobile ? "bottom" : "right"}
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex items-center gap-2 text-left text-sm">
                      <Avatar className="size-8 border">
                        <AvatarImage
                          src={user.imageUrl}
                          alt={user.firstName || "User"}
                        />
                        <AvatarFallback>
                          {user.firstName?.charAt(0) ||
                            user.emailAddresses[0]?.emailAddress?.charAt(0) ||
                            "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 leading-tight">
                        <span className="font-semibold">
                          {user.fullName || user.firstName || "User"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.emailAddresses[0]?.emailAddress || ""}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>

                  {/* Credit balance and Buy Credits button */}
                  <div className="px-2 pt-2">
                    <div className="rounded-md bg-muted/40 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                          Credit Balance
                        </span>
                        <span className="text-sm font-semibold">
                          {isLoadingUser ? "..." : (credits ?? 0)}
                        </span>
                      </div>
                      <Link
                        href="/billing"
                        onClick={handleNavigation}
                        className="mt-2 block"
                      >
                        <Button size="sm" variant="outline" className="w-full">
                          <PlusCircle className="size-3.5" />
                          <span>Buy Credits</span>
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <DropdownMenuSeparator className="my-2" />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => openUserProfile()}>
                      <User className="size-4" />
                      <span>Manage Account</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/billing"
                        className="flex w-full items-center"
                        onClick={handleNavigation}
                      >
                        <CreditCard className="size-4" />
                        <span>Billing</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="size-4" />
                    <span>Log Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton disabled className="h-auto py-2">
                <Skeleton className="size-8 rounded-full" />
                {open && (
                  <div className="grid flex-1 gap-1 text-left">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                )}
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
