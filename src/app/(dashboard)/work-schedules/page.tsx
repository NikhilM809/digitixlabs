"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Clock, Download, Loader2, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canManageWorkSchedules } from "@/lib/permissions";
import { apiFetch, apiFetchArray } from "@/lib/client-api";
import { ExcelImportDialog } from "@/components/admin/excel-import-dialog";

interface EmployeeSchedule {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  workStartTime: string | null;
  workEndTime: string | null;
  lateThreshold: number | null;
  department?: { name: string } | null;
}

interface CompanySettings {
  workStartTime: string;
  workEndTime: string;
  lateThreshold: number;
}

export default function WorkSchedulesPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canManage = role ? canManageWorkSchedules(role) : false;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<EmployeeSchedule | null>(null);
  const [editForm, setEditForm] = useState({
    workStartTime: "09:00",
    workEndTime: "18:00",
    lateThreshold: 15,
  });

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => apiFetch<CompanySettings>("/api/settings"),
    enabled: canManage,
  });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees-schedules"],
    queryFn: () =>
      apiFetchArray<EmployeeSchedule>("/api/work-schedules?list=true"),
    enabled: canManage,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      userId: string;
      workStartTime: string;
      workEndTime: string;
      lateThreshold?: number;
    }) =>
      apiFetch("/api/work-schedules", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success("Work schedule updated");
      setEditEmployee(null);
      queryClient.invalidateQueries({ queryKey: ["employees-schedules"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const download = (template: boolean) => {
    const url = template
      ? "/api/work-schedules?template=true"
      : "/api/work-schedules";
    window.open(url, "_blank");
  };

  const openEdit = (emp: EmployeeSchedule) => {
    setEditEmployee(emp);
    setEditForm({
      workStartTime: emp.workStartTime ?? settings?.workStartTime ?? "09:00",
      workEndTime: emp.workEndTime ?? settings?.workEndTime ?? "18:00",
      lateThreshold: emp.lateThreshold ?? settings?.lateThreshold ?? 15,
    });
  };

  const filtered = employees.filter((e) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      e.employeeId.toLowerCase().includes(term) ||
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(term)
    );
  });

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        You do not have access to work schedule management.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-7 w-7 text-brand-600" />
            Work Schedules
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage employee working hours and late thresholds
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => download(true)}>
            <Download className="h-4 w-4" />
            Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => download(false)}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import Excel
          </Button>
        </div>
      </div>

      {settings && (
        <Card glass>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Company Default Schedule</CardTitle>
            <CardDescription>
              Used when an employee has no individual schedule set
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm flex flex-wrap gap-6">
            <span>
              <span className="text-muted-foreground">Start: </span>
              {settings.workStartTime}
            </span>
            <span>
              <span className="text-muted-foreground">End: </span>
              {settings.workEndTime}
            </span>
            <span>
              <span className="text-muted-foreground">Late threshold: </span>
              {settings.lateThreshold} min
            </span>
          </CardContent>
        </Card>
      )}

      <Card glass>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Employee Schedules</CardTitle>
          <Input
            placeholder="Search by name or employee ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md mt-2"
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Employee
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Start
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    End
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Late (min)
                  </th>
                  <th className="h-12 px-4 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      No employees found
                    </td>
                  </tr>
                ) : (
                  filtered.map((emp) => (
                    <tr
                      key={emp.id}
                      className="border-b border-border/50 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{emp.employeeId}</p>
                      </td>
                      <td className="px-4 py-3">
                        {emp.workStartTime ?? settings?.workStartTime ?? "09:00"}
                        {!emp.workStartTime && (
                          <span className="text-xs text-muted-foreground ml-1">(default)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {emp.workEndTime ?? settings?.workEndTime ?? "18:00"}
                      </td>
                      <td className="px-4 py-3">
                        {emp.lateThreshold ?? settings?.lateThreshold ?? 15}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => openEdit(emp)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editEmployee} onOpenChange={(o) => !o && setEditEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Work Schedule</DialogTitle>
            <DialogDescription>
              {editEmployee?.firstName} {editEmployee?.lastName} ({editEmployee?.employeeId})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Work Start (HH:MM)</Label>
                <Input
                  value={editForm.workStartTime}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, workStartTime: e.target.value }))
                  }
                  placeholder="09:00"
                />
              </div>
              <div className="space-y-2">
                <Label>Work End (HH:MM)</Label>
                <Input
                  value={editForm.workEndTime}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, workEndTime: e.target.value }))
                  }
                  placeholder="18:00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Late Threshold (minutes)</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={editForm.lateThreshold}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    lateThreshold: Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditEmployee(null)}>
                Cancel
              </Button>
              <Button
                disabled={updateMutation.isPending}
                onClick={() =>
                  editEmployee &&
                  updateMutation.mutate({
                    userId: editEmployee.id,
                    ...editForm,
                  })
                }
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import Work Schedules"
        description="Upload an Excel file with Employee ID, work times, and late threshold."
        uploadUrl="/api/work-schedules"
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["employees-schedules"] })
        }
      />
    </motion.div>
  );
}
