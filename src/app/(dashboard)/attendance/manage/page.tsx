"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CalendarCheck, Loader2, ShieldAlert, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import { fetchApi } from "@/lib/api-client";
import { canManageManualAttendance } from "@/lib/permissions";
import type { RoleName } from "@prisma/client";

interface EmployeeOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  status: string;
}

function toDateTimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ["employees-manual-attendance"],
    queryFn: () => fetchApi<EmployeeOption[]>("/api/employees?activeOnly=true&limit=500"),
    enabled: status === "authenticated" && !!role && canManageManualAttendance(role),
  });

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
        }),
      });
    },
    onSuccess: () => {
      toast.success(
        action === "check-in"
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
      className="mx-auto max-w-2xl space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserCheck className="h-7 w-7 text-brand-600" />
          Manage Attendance
        </h1>
        <p className="text-muted-foreground mt-1">
          Manually record check-in or check-out when an employee cannot use the system
        </p>
      </div>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-brand-600" />
            Manual Entry
          </CardTitle>
          <CardDescription>
            Select the employee, action, and the actual time. Existing attendance rules still apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              Record {action === "check-in" ? "Check In" : "Check Out"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
