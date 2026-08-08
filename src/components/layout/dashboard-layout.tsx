"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { TopNavbar } from "./top-navbar";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import type { RoleName } from "@prisma/client";

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
    role: RoleName;
  };
  notificationCount?: number;
}

export function DashboardLayout({ children, user, notificationCount }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        role={user.role}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={() => signOut({ callbackUrl: "/login" })}
      />

      <div
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64"
        )}
      >
        <TopNavbar
          user={user}
          notificationCount={notificationCount}
          sidebarCollapsed={sidebarCollapsed}
          onMenuClick={() => setMobileOpen(true)}
        />

        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
