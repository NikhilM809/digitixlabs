"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CalendarCheck, History, Loader2, ShieldAlert, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchApi } from "@/lib/api-client";
import { canManageManualAttendance } from "@/lib/permissions";
import { DEFAULT_COMPANY_TIMEZONE, formatTimeInZone } from "@/lib/timezone-utils";
import type { RoleName } from "@prisma/client";

interface EmployeeOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  status: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  isLate: boolean;
  lateReason?: string | null;
  notes?: string | null;
}

interface AttendanceListResponse {
  records: AttendanceRecord[];
}

function toDateTimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isoToDateTimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  return toDateTimeLocalValue(new Date(iso));
}

function todayDateValue() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function ManageAttendancePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = session?.user?.role as RoleName | undefined;

  const [userId, setUserId] = useState("");
  const [action, setAction] = useState<"check-in" | "check-out">("check-in");
  const [timestamp, setTimestamp] = useState(toDateTimeLocalValue(new Date()));
  const [notes, setNotes] = useState("");
  const [lateReason, setLateReason] = useState("");
  const [updateMode, setUpdateMode] = useState(false);

  const [backdateUserId, setBackdateUserId] = useState("");
  const [backdateDate, setBackdateDate] = useState(todayDateValue());
  const [backdateCheckIn, setBackdateCheckIn] = useState("");
  const [backdateCheckOut, setBackdateCheckOut] = useState("");
  const [backdateNotes, setBackdateNotes] = useState("");
  const [backdateLateReason, setBackdateLateReason] = useState("");

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["employees-manual-attendance"],
    queryFn: () => fetchApi<EmployeeOption[]>("/api/employees?activeOnly=true"),
    enabled: status === "authenticated" && !!role && canManageManualAttendance(role),
  });

  const { data: existingBackdateRecord, isFetching: loadingBackdateRecord } = useQuery({
    queryKey: ["attendance-backdate-record", backdateUserId, backdateDate],
    queryFn: () =>
      fetchApi<AttendanceListResponse>(
        `/api/attendance?userId=${backdateUserId}&fromDate=${backdateDate}&toDate=${backdateDate}&limit=1`
      ),
    enabled: !!backdateUserId && !!backdateDate,
  });

  const existingRecord = existingBackdateRecord?.records[0] ?? null;

  useEffect(() => {
    setBackdateCheckIn(isoToDateTimeLocal(existingRecord?.checkIn));
    setBackdateCheckOut(isoToDateTimeLocal(existingRecord?.checkOut));
    setBackdateLateReason(existingRecord?.lateReason ?? "");
  }, [existingRecord?.id, existingRecord?.checkIn, existingRecord?.checkOut, existingRecord?.lateReason]);

  useEffect(() => {
    if (!backdateDate) return;

    const syncDatePart = (value: string) => {
      if (!value) return value;
      const timePart = value.includes("T") ? value.split("T")[1] : "09:00";
      return `${backdateDate}T${timePart}`;
    };

    setBackdateCheckIn((prev) => syncDatePart(prev));
    setBackdateCheckOut((prev) => syncDatePart(prev));
  }, [backdateDate]);

  const employeeOptions = useMemo(
    () =>
      employees
        .filter((e) => e.status === "ACTIVE" && e.id !== session?.user?.id)
        .sort((a, b) => a.firstName.localeCompare(b.firstName)),
    [employees, session?.user?.id]
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const eventTime = new Date(timestamp);
      if (Number.isNaN(eventTime.getTime())) {
        throw new Error("Invalid date and time");
      }

      return fetchApi("/api/attendance/manual", {
        method: "POST",
        body: JSON.stringify({
          userId,
          action,
          timestamp: eventTime.toISOString(),
          notes: notes.trim() || undefined,
          lateReason: lateReason.trim() || undefined,
          mode: updateMode ? "update" : "record",
        }),
      });
    },
    onSuccess: () => {
      toast.success(
        updateMode
          ? "Attendance time updated successfully"
          : action === "check-in"
            ? "Manual check-in recorded successfully"
            : "Manual check-out recorded successfully"
      );
      setNotes("");
      setLateReason("");
      setTimestamp(toDateTimeLocalValue(new Date()));
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const backdateMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {
        userId: backdateUserId,
        date: backdateDate,
      };

      if (backdateCheckIn) {
        const checkInTime = new Date(backdateCheckIn);
        if (Number.isNaN(checkInTime.getTime())) {
          throw new Error("Invalid check-in time");
        }
        payload.checkIn = checkInTime.toISOString();
      }

      if (backdateCheckOut) {
        const checkOutTime = new Date(backdateCheckOut);
        if (Number.isNaN(checkOutTime.getTime())) {
          throw new Error("Invalid check-out time");
        }
        payload.checkOut = checkOutTime.toISOString();
      }

      if (backdateNotes.trim()) {
        payload.notes = backdateNotes.trim();
      }

      if (backdateLateReason.trim()) {
        payload.lateReason = backdateLateReason.trim();
      }

      return fetchApi("/api/attendance/manual", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success("Backdate attendance updated successfully");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({
        queryKey: ["attendance-backdate-record", backdateUserId, backdateDate],
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (status === "loading") {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (!role || !canManageManualAttendance(role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive/60 mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/dashboard")}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserCheck className="h-7 w-7 text-brand-600" />
          Manage Attendance
        </h1>
        <p className="text-muted-foreground mt-1">
          Record or update employee check-in and check-out times, including past dates
        </p>
      </div>

      <Tabs defaultValue="record" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="record">Record Entry</TabsTrigger>
          <TabsTrigger value="backdate">Update Backdate</TabsTrigger>
        </TabsList>

        <TabsContent value="record">
          <Card glass>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-brand-600" />
                Manual Entry
              </CardTitle>
              <CardDescription>
                Record a new check-in or check-out. Enable update mode to overwrite an existing time for the same date.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
                <div>
                  <p className="text-sm font-medium">Update existing record</p>
                  <p className="text-sm text-muted-foreground">
                    Turn on to change an already recorded check-in or check-out time
                  </p>
                </div>
                <Button
                  type="button"
                  variant={updateMode ? "default" : "outline"}
                  onClick={() => setUpdateMode((value) => !value)}
                >
                  {updateMode ? "Update mode" : "Record mode"}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee">Employee</Label>
                {employeesLoading ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : (
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger id="employee">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeOptions.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName} ({employee.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="action">Action</Label>
                <Select
                  value={action}
                  onValueChange={(value) => setAction(value as "check-in" | "check-out")}
                >
                  <SelectTrigger id="action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check-in">Check In</SelectItem>
                    <SelectItem value="check-out">Check Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timestamp">Date &amp; Time</Label>
                <Input
                  id="timestamp"
                  type="datetime-local"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                />
              </div>

              {action === "check-in" && (
                <div className="space-y-2">
                  <Label htmlFor="lateReason">Late Reason (if applicable)</Label>
                  <Textarea
                    id="lateReason"
                    placeholder="Required if the check-in is after the scheduled start time"
                    value={lateReason}
                    onChange={(e) => setLateReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional context for this manual entry"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!userId || saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {updateMode ? "Update" : "Record"}{" "}
                  {action === "check-in" ? "Check In" : "Check Out"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backdate">
          <Card glass>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-5 w-5 text-brand-600" />
                Update Backdate Attendance
              </CardTitle>
              <CardDescription>
                Select an employee and past date, then update check-in and/or check-out times.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backdate-employee">Employee</Label>
                {employeesLoading ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : (
                  <Select value={backdateUserId} onValueChange={setBackdateUserId}>
                    <SelectTrigger id="backdate-employee">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeeOptions.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.firstName} {employee.lastName} ({employee.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="backdate-date">Attendance Date</Label>
                <Input
                  id="backdate-date"
                  type="date"
                  value={backdateDate}
                  onChange={(e) => setBackdateDate(e.target.value)}
                />
              </div>

              {backdateUserId && backdateDate && (
                <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2">
                  {loadingBackdateRecord ? (
                    <Skeleton className="h-6 w-48" />
                  ) : existingRecord ? (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">Current record</p>
                        <Badge variant="secondary">{existingRecord.status.replace("_", " ")}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Check-in:{" "}
                        {existingRecord.checkIn
                          ? formatTimeInZone(existingRecord.checkIn, DEFAULT_COMPANY_TIMEZONE)
                          : "—"}
                        {" · "}
                        Check-out:{" "}
                        {existingRecord.checkOut
                          ? formatTimeInZone(existingRecord.checkOut, DEFAULT_COMPANY_TIMEZONE)
                          : "—"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No attendance record for this date yet. Saving will create one.
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="backdate-check-in">Check-In Time</Label>
                  <Input
                    id="backdate-check-in"
                    type="datetime-local"
                    value={backdateCheckIn}
                    onChange={(e) => setBackdateCheckIn(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backdate-check-out">Check-Out Time</Label>
                  <Input
                    id="backdate-check-out"
                    type="datetime-local"
                    value={backdateCheckOut}
                    onChange={(e) => setBackdateCheckOut(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="backdate-late-reason">Late Reason (if applicable)</Label>
                <Textarea
                  id="backdate-late-reason"
                  placeholder="Required if the updated check-in is after the scheduled start time"
                  value={backdateLateReason}
                  onChange={(e) => setBackdateLateReason(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="backdate-notes">Notes (optional)</Label>
                <Textarea
                  id="backdate-notes"
                  placeholder="Reason for this backdate correction"
                  value={backdateNotes}
                  onChange={(e) => setBackdateNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => backdateMutation.mutate()}
                  disabled={
                    !backdateUserId ||
                    !backdateDate ||
                    (!backdateCheckIn && !backdateCheckOut) ||
                    backdateMutation.isPending
                  }
                >
                  {backdateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Backdate Attendance
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
