"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  Timer,
  Users,
  Wallet,
  Archive,
  ChartColumn,
} from "lucide-react";
import { useTheme } from "next-themes";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";
import { logoutAction } from "@/worknest/actions/auth";
import { markAllNotificationsRead, markNotificationRead } from "@/worknest/actions/misc";
import { Button } from "@/worknest/components/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { APP_NAME, APP_TAGLINE } from "@/worknest/lib/constants";
import { formatDate } from "@/worknest/lib/format";
import { BrandLogo } from "@/worknest/components/logo";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

const ADMIN_NAV: NavItem[] = [
  { href: "/worknest/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/worknest/projects", label: "Projects", icon: FolderKanban },
  { href: "/worknest/hours", label: "Hours", icon: Timer },
  { href: "/worknest/employees", label: "Employees", icon: Users },
  { href: "/worknest/reports", label: "Reports", icon: ChartColumn },
  { href: "/worknest/billing", label: "Billing", icon: Wallet },
  { href: "/worknest/closed", label: "Closed Projects", icon: Archive },
  { href: "/worknest/settings", label: "Settings", icon: Settings },
];

const MANAGER_NAV: NavItem[] = [
  { href: "/worknest/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/worknest/projects", label: "Projects", icon: FolderKanban },
  { href: "/worknest/team", label: "My Team", icon: Users },
  { href: "/worknest/hours", label: "Hours", icon: Timer },
  { href: "/worknest/closed", label: "Closed Projects", icon: Archive },
];

const EMPLOYEE_NAV: NavItem[] = [
  { href: "/worknest/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/worknest/my-projects", label: "My Projects", icon: FolderKanban },
  { href: "/worknest/my-tasks", label: "My Tasks", icon: ClipboardList },
  { href: "/worknest/my-hours", label: "My Hours", icon: Timer },
];

function navFor(role: Role) {
  if (role === "ADMIN") return ADMIN_NAV;
  if (role === "MANAGER") return MANAGER_NAV;
  return EMPLOYEE_NAV;
}

export function AppShell({
  user,
  notifications,
  children,
}: {
  user: { name: string; email: string; role: Role };
  notifications: { id: string; title: string; message: string; href: string | null; read: boolean; createdAt: Date }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = navFor(user.role);
  const unread = notifications.filter((item) => !item.read).length;
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-navy text-white lg:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <BrandLogo className="h-10 w-10 ring-1 ring-white/15" />
          <div>
            <p className="font-display text-2xl tracking-tight">{APP_NAME}</p>
            <p className="mt-0.5 text-xs text-white/60">{APP_TAGLINE}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                  active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 px-3 pb-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white"
          >
            <LayoutDashboard size={18} />
            HRMS
          </Link>
        </div>
        <form action={logoutAction} className="p-4">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white">
            <LogOut size={18} />
            Sign out
          </button>
        </form>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <BrandLogo className="h-8 w-8" />
            <p className="font-display text-lg">{APP_NAME}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="hidden dark:block" size={16} />
              <Moon className="dark:hidden" size={16} />
            </Button>
            <div className="relative">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
                <Bell size={16} />
                {unread > 0 ? (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold" />
                ) : null}
              </Button>
              {open ? (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-paper-card shadow-xl">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2">
                    <p className="text-sm font-medium">Notifications</p>
                    <form action={markAllNotificationsRead}>
                      <button className="text-xs text-teal">Mark all read</button>
                    </form>
                  </div>
                  <div className="max-h-80 overflow-auto">
                    {notifications.length === 0 ? (
                      <p className="px-3 py-8 text-center text-sm text-muted">No notifications yet.</p>
                    ) : (
                      notifications.map((item) => (
                        <form key={item.id} action={markNotificationRead.bind(null, item.id)}>
                          <button className="block w-full px-3 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5">
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted">{item.message}</p>
                            <p className="mt-1 text-[11px] text-muted">{formatDate(item.createdAt)}</p>
                          </button>
                        </form>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs capitalize text-muted">{user.role.toLowerCase()}</p>
            </div>
          </div>
        </header>
        <div className="flex gap-2 overflow-x-auto border-b border-line px-4 py-2 lg:hidden">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1 text-sm",
                pathname.startsWith(item.href) ? "bg-navy text-white" : "bg-black/5 dark:bg-white/5",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
