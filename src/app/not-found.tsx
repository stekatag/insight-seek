"use client";

import Link from "next/link";
import { SignedIn } from "@clerk/nextjs";
import { DashboardIcon } from "@radix-ui/react-icons";
import { HomeIcon, Search } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex h-screen flex-col items-center justify-center gap-4 text-center p-4">
      <div className="rounded-full bg-muted p-6">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-3xl font-bold tracking-tight">Page Not Found</h2>
      <p className="max-w-md text-muted-foreground">
        Sorry, we couldn't find the page you're looking for. The page might have
        been moved, deleted, or never existed.
      </p>
      <div className="flex gap-4">
        <Link href="/">
          <Button>
            <HomeIcon className="h-4 w-4" />
            <span>Home Page</span>
          </Button>
        </Link>
        <SignedIn>
          <Link href="/dashboard">
            <Button variant="outline">
              <DashboardIcon className="h-4 w-4" />
              <span>Dashboard</span>
            </Button>
          </Link>
        </SignedIn>
      </div>
    </div>
  );
}
