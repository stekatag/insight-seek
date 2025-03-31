"use client";

import React from "react";
import Link from "next/link";
import { SignedIn, SignedOut, useClerk } from "@clerk/nextjs";
import { GitHubLogoIcon } from "@radix-ui/react-icons";
import { ChevronsDown, Menu } from "lucide-react";

import ApplicationLogo from "../application-logo";
import { ToggleTheme } from "../toggle-theme";
import { Button } from "../ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "../ui/navigation-menu";
import { Separator } from "../ui/separator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";

interface RouteProps {
  href: string;
  label: string;
}

// Add currentPath prop with default value
interface NavbarProps {
  currentPath?: string;
}

const routeList: RouteProps[] = [
  {
    href: "#features",
    label: "Features",
  },
  {
    href: "#testimonials",
    label: "Testimonials",
  },
  {
    href: "#contact",
    label: "Contact",
  },
];

// Authentication routes for signed in users
const signedInRoutes: (RouteProps & { variant?: "ghost" | "default" })[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    variant: "default",
  },
  {
    href: "#",
    label: "Sign Out",
    variant: "ghost",
    // This will be handled specially with onClick
  },
];

// Authentication routes for signed out users
const signedOutRoutes: (RouteProps & { variant?: "ghost" | "default" })[] = [
  {
    href: "/sign-up",
    label: "Get Started",
    variant: "default",
  },
  {
    href: "/sign-in",
    label: "Sign In",
    variant: "ghost",
  },
];

// Modified the component to accept currentPath prop
export const Navbar = ({ currentPath = "/" }: NavbarProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const { signOut } = useClerk();

  // Handle sign out with clerk
  const handleSignOut = (e: React.MouseEvent) => {
    e.preventDefault();
    signOut();
  };

  // Helper function to adjust link hrefs when on non-home pages
  const getHref = (href: string) => {
    if (currentPath === "/") return href;
    return href.startsWith("#") ? "/" + href : href;
  };

  return (
    <header className="shadow-inner bg-opacity-15 w-[90%] md:w-[70%] lg:w-[75%] lg:max-w-screen-xl top-5 mx-auto sticky border dark:border-secondary z-40 rounded-2xl flex justify-between items-center p-2 bg-card">
      <Link href="/" className="font-bold text-lg flex items-center gap-2">
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <ApplicationLogo className="p-1.5" />
        </div>
        <span>InsightSeek</span>
      </Link>

      {/* <!-- Mobile --> */}
      <div className="flex items-center lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Menu
              onClick={() => setIsOpen(!isOpen)}
              className="cursor-pointer lg:hidden"
            />
          </SheetTrigger>

          <SheetContent
            side="right"
            className="flex flex-col justify-between rounded-tl-2xl rounded-bl-2xl bg-card border-secondary"
          >
            <div>
              <SheetHeader className="mb-4 ml-4">
                <SheetTitle className="flex items-center">
                  <Link href="/" className="flex items-center">
                    <ChevronsDown className="bg-gradient-to-tr border-secondary from-primary via-primary/70 to-primary rounded-lg w-9 h-9 mr-2 border text-white" />
                    Shadcn
                  </Link>
                </SheetTitle>
              </SheetHeader>

              {/* Navigation links */}
              <div className="flex flex-col gap-2">
                {routeList.map(({ href, label }) => (
                  <Button
                    key={href}
                    onClick={() => setIsOpen(false)}
                    asChild
                    variant="ghost"
                    className="justify-start text-base"
                  >
                    <Link href={getHref(href)}>{label}</Link>
                  </Button>
                ))}

                {/* Authentication links for mobile */}
                <Separator className="my-2" />

                <SignedIn>
                  {signedInRoutes.map(({ href, label, variant = "ghost" }) => (
                    <Button
                      key={label}
                      onClick={(e) => {
                        if (label === "Sign Out") {
                          handleSignOut(e);
                        }
                        setIsOpen(false);
                      }}
                      asChild={label !== "Sign Out"}
                      variant={variant}
                      className="justify-start text-base"
                    >
                      {label === "Sign Out" ? (
                        <div>{label}</div>
                      ) : (
                        <Link href={href}>{label}</Link>
                      )}
                    </Button>
                  ))}
                </SignedIn>

                <SignedOut>
                  {signedOutRoutes.map(({ href, label, variant = "ghost" }) => (
                    <Button
                      key={href}
                      onClick={() => setIsOpen(false)}
                      asChild
                      variant={variant}
                      className="justify-start text-base"
                    >
                      <Link href={href}>{label}</Link>
                    </Button>
                  ))}
                </SignedOut>
              </div>
            </div>

            <SheetFooter className="flex-col sm:flex-col justify-start">
              <Separator className="mb-2" />
              <div className="flex gap-2 justify-between items-center">
                <ToggleTheme />
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  aria-label="View on GitHub"
                >
                  <Link
                    aria-label="View on GitHub"
                    href="https://github.com/stekatag/insight-seek"
                    target="_blank"
                  >
                    <GitHubLogoIcon className="size-5" />
                  </Link>
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* <!-- Desktop Navigation --> */}
      <NavigationMenu className="hidden lg:block mx-auto">
        <NavigationMenuList>
          <NavigationMenuItem>
            {routeList.map(({ href, label }) => (
              <NavigationMenuLink key={href} asChild>
                <Link href={getHref(href)}>
                  <Button variant="ghost">{label}</Button>
                </Link>
              </NavigationMenuLink>
            ))}
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      <div className="hidden lg:flex lg:gap-4 lg:items-center">
        {/* <!-- Desktop Authentication --> */}
        <NavigationMenu className="hidden lg:block mx-auto">
          <NavigationMenuList>
            <SignedIn>
              {signedInRoutes.map(({ href, label, variant = "ghost" }) => (
                <NavigationMenuItem key={label}>
                  <NavigationMenuLink asChild={label !== "Sign Out"}>
                    {label === "Sign Out" ? (
                      <Button variant={variant} onClick={handleSignOut}>
                        {label}
                      </Button>
                    ) : (
                      <Link href={href}>
                        <Button variant={variant}>{label}</Button>
                      </Link>
                    )}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </SignedIn>

            <SignedOut>
              {signedOutRoutes.map(({ href, label, variant = "ghost" }) => (
                <NavigationMenuItem key={href}>
                  <NavigationMenuLink asChild>
                    <Link href={href}>
                      <Button variant={variant}>{label}</Button>
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ))}
            </SignedOut>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex gap-2 items-center">
          <ToggleTheme />

          <Button
            asChild
            variant="outline"
            size="icon"
            aria-label="View on GitHub"
          >
            <Link
              aria-label="View on GitHub"
              href="https://github.com/stekatag/insight-seekt"
              target="_blank"
            >
              <GitHubLogoIcon className="size-5" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
};
