"use client";

import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import {
  ChevronsUpDown,
  CreditCard,
  LogOut,
  PlusCircle,
  User as UserIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
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
import { Skeleton } from "@/components/ui/skeleton";

type UserDropdownProps = {
  /**
   * Type of display - 'full' shows user info, 'icon' shows just the avatar
   */
  variant?: "full" | "icon";

  /**
   * Optional handler when navigation occurs (for mobile sidebar closing)
   */
  onNavigate?: () => void;

  /**
   * Optional className for the trigger button
   */
  className?: string;

  /**
   * Position of dropdown menu
   */
  align?: "start" | "center" | "end";

  /**
   * Side of dropdown menu
   */
  side?: "top" | "right" | "bottom" | "left";

  /**
   * Whether the sidebar is collapsed (for padding adjustments)
   */
  isCollapsed?: boolean;
};

export default function UserDropdown({
  variant = "full",
  onNavigate,
  className,
  align = "end",
  side = "bottom",
  isCollapsed = false,
}: UserDropdownProps) {
  const { user, isLoaded } = useUser();
  const { openUserProfile, signOut } = useClerk();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const baseTheme = isDark ? dark : undefined;

  // Fetch user credits data
  const { data: userData, isLoading: isLoadingUser } =
    api.user.getMyCredits.useQuery(undefined, {
      enabled: isLoaded && !!user,
      staleTime: 0,
    });

  // Extract credits correctly
  const credits = userData?.credits ?? null;

  if (!isLoaded) {
    return variant === "icon" ? (
      <Skeleton className="h-8 w-8 rounded-full" />
    ) : (
      <Skeleton className="h-9 w-36 rounded-md" />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          // Icon-only version for top bar
          <Button variant="ghost" size="sm" className={className}>
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user?.imageUrl}
                alt={user?.firstName || "User"}
              />
              <AvatarFallback>
                {user?.firstName?.charAt(0) ||
                  user?.emailAddresses[0]?.emailAddress?.charAt(0) ||
                  "U"}
              </AvatarFallback>
            </Avatar>
          </Button>
        ) : (
          // Full version with name and credits for sidebar
          // Apply p-0 when sidebar is collapsed
          <Button
            variant="ghost"
            size="lg"
            className={cn(
              "h-auto w-full justify-start data-[state=open]:bg-sidebar-accent",
              isCollapsed ? "p-0" : "p-2",
              className,
            )}
          >
            <Avatar className="size-8">
              <AvatarImage
                src={user?.imageUrl}
                alt={user?.firstName || "User"}
              />
              <AvatarFallback>
                {user?.firstName?.charAt(0) ||
                  user?.emailAddresses[0]?.emailAddress?.charAt(0) ||
                  "U"}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {user?.fullName || user?.firstName || "User"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {isLoadingUser ? "Loading..." : `${credits ?? 0} credits`}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 opacity-60" />
              </>
            )}
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="min-w-56"
        align={align}
        side={side}
        sideOffset={4}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2 text-left text-sm">
            <Avatar className="size-8 border">
              <AvatarImage
                src={user?.imageUrl}
                alt={user?.firstName || "User"}
              />
              <AvatarFallback>
                {user?.firstName?.charAt(0) ||
                  user?.emailAddresses[0]?.emailAddress?.charAt(0) ||
                  "U"}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 leading-tight">
              <span className="font-semibold">
                {user?.fullName || user?.firstName || "User"}
              </span>
              <span className="text-xs text-muted-foreground">
                {user?.emailAddresses[0]?.emailAddress || ""}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        {/* Credit balance and Buy Credits button */}
        <div className="px-2 pt-2">
          <div className="rounded-md bg-sidebar dark:bg-muted/40 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Credit Balance</span>
              <span className="text-sm font-semibold">
                {isLoadingUser ? "..." : (credits ?? 0)}
              </span>
            </div>
            <Link href="/billing" onClick={onNavigate} className="mt-2 block">
              <Button size="sm" variant="outline" className="w-full">
                <PlusCircle className=" size-3.5" />
                <span>Buy Credits</span>
              </Button>
            </Link>
          </div>
        </div>

        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() =>
              openUserProfile({
                appearance: {
                  baseTheme: baseTheme,
                },
              })
            }
          >
            <UserIcon className=" size-4" />
            <span>Manage Account</span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/billing"
              className="flex w-full items-center"
              onClick={onNavigate}
            >
              <CreditCard className=" size-4" />
              <span>Billing</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOut className=" size-4" />
          <span>Log Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
