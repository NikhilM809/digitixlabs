"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Target,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  CheckCircle2,
  Lock,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canAccessKra, canConfigureKra, isAdminOrHr } from "@/lib/permissions";
import { formatKraWeight } from "@/lib/employee-kra";
import { apiFetch, apiFetchArray } from "@/lib/client-api";

interface EmployeeOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  managerId?: string | null;
}

interface EmployeeKraItem {
  id: string;
  userId: string;
  name: string;
  measure: string;
  weight: number | null;
  sortOrder: number;
}

interface KraConfigResponse {
  items: EmployeeKraItem[];
  config: {
    userId: string;
    isFinalized: boolean;
    finalizedAt?: string | null;
    periodLabel?: string | null;
    remarks?: string | null;
  };
  weightSummary: {
    total: number;
    remaining: number;
    excess: number;
    isValid: boolean;
    weightedCount: number;
    qualitativeCount: number;
  };
  weightMessage: string;
}

export default function KraPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const isConfigurator = role ? canConfigureKra(role) : false;
  const isEmployeeOnly = role === "EMPLOYEE";

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<EmployeeKraItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formMeasure, setFormMeasure] = useState("");
  const [formWeight, setFormWeight] = useState("");
  const [formQualitative, setFormQualitative] = useState(false);
  const [periodLabel, setPeriodLabel] = useState("");
  const [remarks, setRemarks] = useState("");

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-kra"],
    queryFn: () => apiFetchArray<EmployeeOption>("/api/employees"),
    enabled: status === "authenticated" && isConfigurator,
  });

  const manageableEmployees = useMemo(() => {
    if (!role || !userId) return employees;
    if (isAdminOrHr(role)) return employees.filter((e) => e.id !== userId);
    if (role === "MANAGER") {
      return employees.filter((e) => e.managerId === userId);
    }
    return [];
  }, [employees, role, userId]);

  const targetUserId = isEmployeeOnly ? userId! : selectedEmployeeId;

  useEffect(() => {
    if (isConfigurator && !selectedEmployeeId && manageableEmployees.length > 0) {
      setSelectedEmployeeId(manageableEmployees[0].id);
    }
  }, [isConfigurator, manageableEmployees, selectedEmployeeId]);

  const { data: kraData, isLoading } = useQuery({
    queryKey: ["employee-kra", targetUserId],
    queryFn: () =>
      apiFetch<KraConfigResponse>(
        isEmployeeOnly
          ? "/api/employee-kra"
          : `/api/employee-kra?userId=${targetUserId}`
      ),
    enabled: status === "authenticated" && !!targetUserId && !!role && canAccessKra(role),
  });

  useEffect(() => {
    if (kraData?.config) {
      setPeriodLabel(kraData.config.periodLabel ?? "");
      setRemarks(kraData.config.remarks ?? "");
    }
  }, [kraData?.config]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["employee-kra", targetUserId] });

  const addMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      measure: string;
      weight: number | null;
    }) =>
      apiFetch<KraConfigResponse>("/api/employee-kra", {
        method: "POST",
        body: JSON.stringify({ userId: targetUserId, ...payload }),
      }),
    onSuccess: () => {
      toast.success("KRA added");
      setAddOpen(false);
      resetForm();
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      name: string;
      measure: string;
      weight: number | null;
    }) =>
      apiFetch<KraConfigResponse>(`/api/employee-kra/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: payload.name,
          measure: payload.measure,
          weight: payload.weight,
        }),
      }),
    onSuccess: () => {
      toast.success("KRA updated");
      setEditItem(null);
      resetForm();
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/employee-kra/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("KRA removed");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const finalizeMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/employee-kra/finalize", {
        method: "POST",
        body: JSON.stringify({
          userId: targetUserId,
          periodLabel: periodLabel || null,
          remarks: remarks || null,
        }),
      }),
    onSuccess: () => {
      toast.success("KRA configuration finalized");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reopenMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/employee-kra/finalize?userId=${targetUserId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("KRA configuration reopened for editing");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function resetForm() {
    setFormName("");
    setFormMeasure("");
    setFormWeight("");
    setFormQualitative(false);
  }

  function openAdd() {
    resetForm();
    setAddOpen(true);
  }

  function openEdit(item: EmployeeKraItem) {
    setEditItem(item);
    setFormName(item.name);
    setFormMeasure(item.measure);
    setFormQualitative(item.weight === null);
    setFormWeight(item.weight === null ? "" : String(item.weight));
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formMeasure.trim()) {
      toast.error("Enter KRA and Measure");
      return;
    }

    let weight: number | null = null;
    if (!formQualitative) {
      const parsed = parseFloat(formWeight);
      if (Number.isNaN(parsed) || parsed <= 0) {
        toast.error("Enter a weight greater than 0, or mark as qualitative KRA");
        return;
      }
      weight = parsed;
    }

    if (editItem) {
      updateMutation.mutate({
        id: editItem.id,
        name: formName.trim(),
        measure: formMeasure.trim(),
        weight,
      });
    } else {
      addMutation.mutate({
        name: formName.trim(),
        measure: formMeasure.trim(),
        weight,
      });
    }
  }

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!role || !canAccessKra(role)) {
    return (
      <Card glass>
        <CardContent className="py-12 text-center text-muted-foreground">
          You do not have access to KRA.
        </CardContent>
      </Card>
    );
  }

  const isFinalized = kraData?.config.isFinalized ?? false;
  const canEdit = isConfigurator && !isEmployeeOnly && !isFinalized;
  const selectedEmployee = manageableEmployees.find((e) => e.id === targetUserId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Target className="h-7 w-7 text-brand-600" />
          Key Result Areas (KRA)
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEmployeeOnly
            ? "Your assigned KRAs — KRA, Measure, and Weight as configured by Admin/Manager"
            : "Configure KRAs per the Digitix sheet — weighted KRAs must total 100%"}
        </p>
      </div>

      {isConfigurator && !isEmployeeOnly && (
        <Card glass>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Employee</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Choose employee" />
              </SelectTrigger>
              <SelectContent>
                {manageableEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Card glass>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">
              {isEmployeeOnly
                ? "My Assigned KRAs"
                : selectedEmployee
                  ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}'s KRAs`
                  : "Assigned KRAs"}
            </CardTitle>
            {(kraData?.config.periodLabel || periodLabel) && (
              <CardDescription className="mt-1">
                {kraData?.config.periodLabel || periodLabel}
              </CardDescription>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isFinalized ? (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                Finalized
              </Badge>
            ) : (
              <Badge variant="secondary">Draft</Badge>
            )}
            {canEdit && (
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add KRA
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="period-label">Review Period (optional)</Label>
                <Input
                  id="period-label"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  placeholder="e.g. Survey Programming and Operations (Quarterly - APR 2026)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kra-remarks">Overall Remarks (optional)</Label>
                <Input
                  id="kra-remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Overall 50% performance"
                />
              </div>
            </div>
          )}

          {kraData && (
            <div
              className={`rounded-xl border p-3 text-sm ${
                kraData.weightSummary.isValid
                  ? "border-green-500/40 bg-green-500/10 text-green-800 dark:text-green-300"
                  : kraData.weightSummary.excess > 0
                    ? "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
              }`}
            >
              {kraData.weightMessage}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground w-16">
                    S.No
                  </th>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground">
                    KRA
                  </th>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground min-w-[240px]">
                    Measure
                  </th>
                  <th className="h-11 px-3 text-right font-medium text-muted-foreground w-24">
                    Weight
                  </th>
                  {canEdit && (
                    <th className="h-11 px-3 text-right font-medium text-muted-foreground w-24">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: canEdit ? 5 : 4 }).map((_, j) => (
                        <td key={j} className="px-3 py-3">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !kraData?.items.length ? (
                  <tr>
                    <td
                      colSpan={canEdit ? 5 : 4}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      {isEmployeeOnly
                        ? "No KRAs assigned yet. Contact your manager or HR."
                        : "No KRAs configured. Add weighted KRAs (total 100%) and optional qualitative KRAs."}
                    </td>
                  </tr>
                ) : (
                  kraData.items.map((item, index) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/50 hover:bg-muted/20 align-top"
                    >
                      <td className="px-3 py-3 text-muted-foreground">
                        {item.sortOrder > 0 ? item.sortOrder : index + 1}
                      </td>
                      <td className="px-3 py-3 font-medium">{item.name}</td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-pre-wrap">
                        {item.measure}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold">
                        {formatKraWeight(item.weight)}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!isEmployeeOnly && kraData?.config.remarks && isFinalized && (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm">
              <span className="font-medium">Remarks: </span>
              {kraData.config.remarks}
            </div>
          )}

          {isConfigurator && !isEmployeeOnly && targetUserId && (
            <div className="flex flex-wrap gap-2 pt-2">
              {!isFinalized ? (
                <Button
                  onClick={() => finalizeMutation.mutate()}
                  disabled={
                    finalizeMutation.isPending ||
                    !kraData?.weightSummary.isValid ||
                    !kraData?.items.length
                  }
                >
                  {finalizeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Finalize KRA Configuration
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => reopenMutation.mutate()}
                  disabled={reopenMutation.isPending}
                >
                  {reopenMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                  Reopen for Editing
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={addOpen || !!editItem}
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false);
            setEditItem(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit KRA" : "Add KRA"}</DialogTitle>
            <DialogDescription>
              Match the Digitix KRA sheet: KRA, Measure, and Weight (%)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kra-name">KRA</Label>
              <Input
                id="kra-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Email confirmation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kra-measure">Measure</Label>
              <Textarea
                id="kra-measure"
                value={formMeasure}
                onChange={(e) => setFormMeasure(e.target.value)}
                placeholder="e.g. Emails confirmed on time (Max 10-15 minutes delay...)"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-3">
              <Label htmlFor="qualitative" className="font-normal leading-snug">
                Qualitative KRA (no weight — e.g. Guiding Juniors)
              </Label>
              <Switch
                id="qualitative"
                checked={formQualitative}
                onCheckedChange={setFormQualitative}
              />
            </div>
            {!formQualitative && (
              <div className="space-y-2">
                <Label htmlFor="kra-weight">Weight (%)</Label>
                <Input
                  id="kra-weight"
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddOpen(false);
                  setEditItem(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addMutation.isPending || updateMutation.isPending}
              >
                {(addMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editItem ? "Save Changes" : "Add KRA"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
