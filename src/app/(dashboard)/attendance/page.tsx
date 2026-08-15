"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  LogIn,
  LogOut,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/dashboard/activity-feed";
import { fetchApi } from "@/lib/api-client";
import { formatDate, formatDateTime, formatLocalDate, cn } from "@/lib/utils";
import { canViewLateAttendance } from "@/lib/permissions";
import type { RoleName } from "@prisma/client";

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  workingHours: number | null;
  isLate: boolean;
  lateReason?: string | null;
  notes?: string | null;
  user?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    department?: { name: string } | null;
  };
}

interface AttendanceListResponse {
  records: AttendanceRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const statusConfig: Record<string, { variant: "success" | "warning" | "destructive" | "info" | "secondary"; icon: typeof CheckCircle2 }> = {
  PRESENT: { variant: "success", icon: CheckCircle2 },
  LATE: { variant: "warning", icon: AlertCircle },
  ABSENT: { variant: "destructive", icon: XCircle },
  HALF_DAY: { variant: "info", icon: Clock },
  ON_LEAVE: { variant: "secondary", icon: Calendar },
  WORK_FROM_HOME: { variant: "info", icon: CheckCircle2 },
};

function formatMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    fromDate: formatLocalDate(start),
    toDate: formatLocalDate(end),
  };
}

function formatTimeFromISO(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AttendancePage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const userId = session?.user?.id;
  const role = session?.user?.role as RoleName | undefined;
  const canViewLate = role ? canViewLateAttendance(role) : false;
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [lateReason, setLateReason] = useState("");
  const monthRange = formatMonthRange(selectedYear, selectedMonth);

  const { data: checkInPreview } = useQuery({
    queryKey: ["attendance-check-in-preview", todayStr, userId],
    queryFn: () =>
      fetchApi<{
        workStartTime: string;
        lateThreshold: number;
        isLateNow: boolean;
        alreadyCheckedIn: boolean;
      }>("/api/attendance/check-in-preview"),
    enabled: !!userId && checkInOpen,
  });

  const { data: todayData, isLoading: todayLoading, isError: todayError } = useQuery({
    queryKey: ["attendance-today", todayStr, userId],
    queryFn: () =>
      fetchApi<AttendanceListResponse>(
        `/api/attendance?userId=${userId}&fromDate=${todayStr}&toDate=${todayStr}&limit=1`
      ),
    enabled: !!userId,
  });

  const { data: historyData, isLoading: historyLoading, isError: historyError } = useQuery({
    queryKey: ["attendance-history", selectedMonth, selectedYear, userId],
    queryFn: () =>
      fetchApi<AttendanceListResponse>(
        `/api/attendance?userId=${userId}&fromDate=${monthRange.fromDate}&toDate=${monthRange.toDate}&limit=100`
      ),
    enabled: !!userId,
  });

  const { data: lateData, isLoading: lateLoading } = useQuery({
    queryKey: ["attendance-late", selectedMonth, selectedYear],
    queryFn: () =>
      fetchApi<AttendanceListResponse>(
        `/api/attendance?lateOnly=true&fromDate=${monthRange.fromDate}&toDate=${monthRange.toDate}&limit=100`
      ),
    enabled: canViewLate,
  });

  const checkInMutation = useMutation({
    mutationFn: (reason?: string) =>
      fetchApi("/api/attendance", {
        method: "POST",
        body: JSON.stringify({
          action: "check-in",
          lateReason: reason?.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Checked in successfully!");
      setCheckInOpen(false);
      setLateReason("");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-late"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const checkOutMutation = useMutation({
    mutationFn: () =>
      fetchApi("/api/attendance", {
        method: "POST",
        body: JSON.stringify({ action: "check-out" }),
      }),
    onSuccess: () => {
      toast.success("Checked out successfully!");
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isProcessing = checkInMutation.isPending || checkOutMutation.isPending;

  function handleCheckInClick() {
    setLateReason("");
    setCheckInOpen(true);
  }

  function submitCheckIn() {
    if (checkInPreview?.isLateNow && lateReason.trim().length < 5) {
      toast.error("Please provide a reason for your late arrival (minimum 5 characters).");
      return;
    }
    checkInMutation.mutate(lateReason);
  }

  const today = todayData?.records[0] ?? null;
  const canCheckIn = !today?.checkIn;
  const canCheckOut = today?.checkIn && !today?.checkOut;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground mt-1">
          Track your daily check-in/out and view attendance history
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2"
        >
          <Card glass className="overflow-hidden">
            <div className="gradient-bg p-6 text-white">
              <p className="text-sm text-white/80">Today&apos;s Status</p>
              <p className="text-3xl font-bold mt-1">
                {todayLoading
                  ? "..."
                  : today?.status?.replace("_", " ") ?? "Not Checked In"}
              </p>
              <p className="text-sm text-white/70 mt-2">
                {formatDate(now)}
              </p>
            </div>
            <CardContent className="p-6">
              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Check In</p>
                  <p className="text-lg font-semibold mt-1">
                    {today?.checkIn ? formatDateTime(today.checkIn) : "—"}
                  </p>
                  {today?.isLate && (
                    <Badge variant="warning" className="mt-2">Late</Badge>
                  )}
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Check Out</p>
                  <p className="text-lg font-semibold mt-1">
                    {today?.checkOut ? formatDateTime(today.checkOut) : "—"}
                  </p>
                  {today?.workingHours != null && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {today.workingHours.toFixed(1)} hours worked
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={handleCheckInClick}
                  disabled={!canCheckIn || isProcessing}
                  className="flex-1 sm:flex-none"
                >
                  <LogIn className="h-5 w-5" />
                  {checkInMutation.isPending ? "Checking in..." : "Check In"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => checkOutMutation.mutate()}
                  disabled={!canCheckOut || isProcessing}
                  className="flex-1 sm:flex-none"
                >
                  <LogOut className="h-5 w-5" />
                  {checkOutMutation.isPending ? "Checking out..." : "Check Out"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card glass className="h-full">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-600" />
                Calendar View
              </CardTitle>
              <CardDescription>Coming soon</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  Interactive calendar view
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Visual attendance calendar will be available in a future update
                </p>
                <div className="grid grid-cols-7 gap-1 mt-6 opacity-40">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i} className="text-xs font-medium text-muted-foreground py-1">
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "aspect-square rounded-lg text-xs flex items-center justify-center",
                        i % 7 === 0 || i % 7 === 6 ? "bg-muted/50" : "bg-muted/20"
                      )}
                    >
                      {(i % 28) + 1}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card glass>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>Your monthly attendance records</CardDescription>
            </div>
            <div className="flex gap-2">
              <select
                className="rounded-xl border border-input bg-background/50 px-3 py-2 text-sm"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {monthNames.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                className="rounded-xl border border-input bg-background/50 px-3 py-2 text-sm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {historyError ? (
            <p className="text-sm text-destructive text-center py-8">Failed to load attendance records.</p>
          ) : historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : historyData?.records && historyData.records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Check In</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Check Out</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Hours</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.records.map((record) => {
                    const config = statusConfig[record.status] ?? statusConfig.PRESENT;
                    const StatusIcon = config.icon;
                    return (
                      <tr key={record.id} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="py-3 px-2 font-medium">{formatDate(record.date)}</td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {record.checkIn ? formatTimeFromISO(record.checkIn) : "—"}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {record.checkOut ? formatTimeFromISO(record.checkOut) : "—"}
                        </td>
                        <td className="py-3 px-2">
                          {record.workingHours != null ? `${record.workingHours.toFixed(1)}h` : "—"}
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant={config.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {record.status.replace("_", " ")}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="No attendance records"
              description={`No attendance data for ${monthNames[selectedMonth - 1]} ${selectedYear}.`}
            />
          )}
        </CardContent>
      </Card>

      {canViewLate && (
        <Card glass>
          <CardHeader>
            <CardTitle>Late Arrivals</CardTitle>
            <CardDescription>
              Review employees who checked in late and their stated reasons
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lateLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : lateData?.records && lateData.records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Check In</th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Reason for Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lateData.records.map((record) => (
                      <tr key={record.id} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="py-3 px-2">
                          <p className="font-medium">
                            {record.user
                              ? `${record.user.firstName} ${record.user.lastName}`
                              : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {record.user?.employeeId}
                          </p>
                        </td>
                        <td className="py-3 px-2">{formatDate(record.date)}</td>
                        <td className="py-3 px-2">
                          {record.checkIn ? formatTimeFromISO(record.checkIn) : "—"}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {record.lateReason || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={Clock}
                title="No late arrivals"
                description={`No late check-ins recorded for ${monthNames[selectedMonth - 1]} ${selectedYear}.`}
              />
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In</DialogTitle>
            <DialogDescription>
              {checkInPreview?.isLateNow
                ? "You are checking in late. Please provide a reason before continuing."
                : "Confirm your check-in for today."}
            </DialogDescription>
          </DialogHeader>
          {checkInPreview?.isLateNow && (
            <div className="space-y-2">
              <Label htmlFor="lateReason">Reason for Late *</Label>
              <Textarea
                id="lateReason"
                placeholder="Briefly explain why you are late today..."
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCheckInOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCheckIn} disabled={checkInMutation.isPending}>
              {checkInMutation.isPending ? "Checking in..." : "Confirm Check In"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
