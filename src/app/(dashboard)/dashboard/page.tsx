"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users,
  CalendarCheck,
  Clock,
  Palmtree,
  PartyPopper,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  AttendanceTrendChart,
  LeaveTrendChart,
  DepartmentChart,
  MonthlyLeaveChart,
} from "@/components/dashboard/charts";
import { RecentActivities, UpcomingEvents } from "@/components/dashboard/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchApi } from "@/lib/api-client";
import { isManager } from "@/lib/roles";

interface DashboardData {
  stats: {
    employeeCount: number;
    presentToday: number;
    onLeave: number;
    pendingApprovals: number;
    upcomingHolidays: number;
    birthdays: number;
    workAnniversaries: number;
  };
  charts: {
    attendanceTrend: { month: string; present: number; absent: number; late: number }[];
    leaveTrend: { month: string; approved: number; rejected: number; pending: number }[];
    departmentWiseEmployees: { name: string; count: number }[];
    monthlyLeaveSummary: { type: string; days: number }[];
  };
  recentActivities: {
    id: string;
    title: string;
    description: string;
    time: string;
    type: "leave" | "attendance" | "announcement" | "birthday" | "anniversary";
  }[];
  upcomingEvents: {
    id: string;
    title: string;
    date: string;
    type: "holiday" | "birthday" | "anniversary";
  }[];
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchApi<DashboardData>("/api/dashboard"),
  });

  if (isLoading) return <DashboardSkeleton />;

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Failed to load dashboard. Please refresh.</p>
      </div>
    );
  }

  const showManagerStats = isManager(session?.user?.role ?? "EMPLOYEE");

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {session?.user?.firstName ?? "there"}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s what&apos;s happening at Digitix Labs today.
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {showManagerStats && (
          <StatCard
            title="Total Employees"
            value={data.stats.employeeCount}
            subtitle="Active workforce"
            icon={Users}
            gradient="blue"
            delay={0}
          />
        )}
        <StatCard
          title="Present Today"
          value={data.stats.presentToday}
          subtitle={`${data.stats.onLeave} on leave`}
          icon={CalendarCheck}
          gradient="green"
          delay={0.05}
        />
        <StatCard
          title="Pending Approvals"
          value={data.stats.pendingApprovals}
          subtitle="Awaiting action"
          icon={Clock}
          gradient="orange"
          delay={0.1}
        />
        <StatCard
          title="Upcoming Holidays"
          value={data.stats.upcomingHolidays}
          subtitle={`${data.stats.birthdays} birthdays this month`}
          icon={showManagerStats ? PartyPopper : Palmtree}
          gradient="purple"
          delay={0.15}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AttendanceTrendChart data={data.charts.attendanceTrend} />
        <LeaveTrendChart data={data.charts.leaveTrend} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {showManagerStats && data.charts.departmentWiseEmployees.length > 0 && (
          <DepartmentChart data={data.charts.departmentWiseEmployees} />
        )}
        {data.charts.monthlyLeaveSummary.some((s) => s.days > 0) && (
          <MonthlyLeaveChart data={data.charts.monthlyLeaveSummary} />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivities activities={data.recentActivities} />
        <UpcomingEvents events={data.upcomingEvents} />
      </div>
    </div>
  );
}
