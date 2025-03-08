import {
  Bot,
  CreditCard,
  HelpCircle,
  Home,
  LayoutDashboard,
  Presentation,
} from "lucide-react";

// Define types for the navigation items
export interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType;
}

export interface NavLinkItem {
  title: string;
  url: string;
  icon: React.ComponentType;
}

// Main navigation items for application routes
export const navMainItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Q&A",
    url: "/qa",
    icon: Bot,
  },
  {
    title: "Meetings",
    url: "/meetings",
    icon: Presentation,
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCard,
  },
];

// Additional links for the sidebar
export const navLinkItems: NavLinkItem[] = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Help",
    url: "/support",
    icon: HelpCircle,
  },
];
