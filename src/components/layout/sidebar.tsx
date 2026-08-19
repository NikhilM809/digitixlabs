"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  FileText,
  Building2,
  BarChart3,
  Bell,
  Settings,
  UserCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Target,
  Network,
  UsersRound,
  GitBranch,
  FolderOpen,
  FolderArchive,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client-api";
import type { RoleName } from "@prisma/client";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: RoleName[];
  requiresOrgVisibility?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "HR", "MANAGER"] },
  { title: "Employees", href: "/employees", icon: Users, roles: ["ADMIN", "HR", "MANAGER"] },
  { title: "Employee Documents", href: "/employee-documents", icon: FolderArchive, roles: ["ADMIN", "HR"] },
  { title: "Attendance", href: "/attendance", icon: CalendarCheck, roles: ["HR", "MANAGER", "EMPLOYEE"] },
  { title: "Leave Management", href: "/leave", icon: CalendarDays, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { title: "Payslips", href: "/payslips", icon: FileText, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { title: "KRA", href: "/kra", icon: Target, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { title: "My Documents", href: "/my-documents", icon: FolderOpen, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  {
    title: "Organization Structure",
    href: "/organization",
    icon: Network,
    roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"],
    requiresOrgVisibility: true,
  },
  { title: "Work Schedules", href: "/work-schedules", icon: Clock, roles: ["ADMIN"] },
  { title: "Departments", href: "/departments", icon: Building2, roles: ["ADMIN"] },
  { title: "Designations", href: "/designations", icon: Briefcase, roles: ["ADMIN"] },
  { title: "Manage Hierarchy", href: "/org-hierarchy", icon: GitBranch, roles: ["ADMIN"] },
  { title: "My Team", href: "/my-team", icon: UsersRound, roles: ["ADMIN", "HR", "MANAGER"] },
  { title: "Reports", href: "/reports", icon: BarChart3, roles: ["ADMIN", "MANAGER"] },
  { title: "Notifications", href: "/notifications", icon: Bell, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { title: "Settings", href: "/settings", icon: Settings, roles: ["ADMIN"] },
  { title: "Policies", href: "/policies", icon: FileText, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
  { title: "Profile", href: "/profile", icon: UserCircle, roles: ["ADMIN", "HR", "MANAGER", "EMPLOYEE"] },
];

interface SidebarProps {
  role: RoleName;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onLogout: () => void;
}

export function Sidebar({
  role,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();

  const { data: orgAccess } = useQuery({
    queryKey: ["org-hierarchy-visibility"],
    queryFn: () => apiFetch<{ canView: boolean }>("/api/org-hierarchy/visibility"),
  });

  const filteredItems = navItems.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.requiresOrgVisibility && orgAccess && !orgAccess.canView) return false;
    return true;
  });

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-3 p-4 border-b border-border/50", collapsed && "justify-center")}>
        <Image
          src="/digitix-logo.png"
          alt="Digitix Labs"
          width={collapsed ? 32 : 140}
          height={collapsed ? 32 : 25}
          className={cn("object-contain", collapsed && "w-8 h-8")}
          priority
        />
        {mobileOpen && (
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={onCloseMobile}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                isActive
                  ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-500/25"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <motion.span
                whileHover={{ x: 4 }}
                className="flex items-center gap-3 min-w-0"
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </motion.span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/50 space-y-1">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-muted-foreground hover:text-destructive focus-visible:ring-offset-card",
            collapsed && "justify-center px-2"
          )}
          onClick={onLogout}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Logout</span>}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex w-full"
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 z-40 h-screen border-r border-border/50 bg-card/80 backdrop-blur-xl transition-all duration-300",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={onCloseMobile}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-border/50 bg-card backdrop-blur-xl lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
