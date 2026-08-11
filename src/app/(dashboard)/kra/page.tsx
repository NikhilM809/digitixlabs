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
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canAccessKra, canConfigureKra, isAdminOrHr } from "@/lib/permissions";
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
  weight: number;
  sortOrder: number;
}

interface KraConfigResponse {
  items: EmployeeKraItem[];
  config: {
    userId: string;
    isFinalized: boolean;
    finalizedAt?: string | null;
  };
  weightSummary: {
    total: number;
    remaining: number;
    excess: number;
    isValid: boolean;
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

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["employee-kra", targetUserId] });

  const addMutation = useMutation({
    mutationFn: (payload: { name: string; measure: string; weight: number }) =>
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
    mutationFn: (payload: { id: string; name: string; measure: string; weight: number }) =>
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
        body: JSON.stringify({ userId: targetUserId }),
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
  }

  function openAdd() {
    resetForm();
    setAddOpen(true);
  }

  function openEdit(item: EmployeeKraItem) {
    setEditItem(item);
    setFormName(item.name);
    setFormMeasure(item.measure);
    setFormWeight(String(item.weight));
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    const weight = parseFloat(formWeight);
    if (!formName.trim() || !formMeasure.trim() || Number.isNaN(weight) || weight <= 0) {
      toast.error("Enter KRA Name, Measure, and a weight greater than 0");
      return;
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
            ? "View your assigned KRAs and evaluation criteria"
            : "Configure employee KRAs — total weight must equal 100% to finalize"}
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
            <CardDescription>
              KRA Name, Measure, and Weight (%)
            </CardDescription>
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
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground">
                    KRA Name
                  </th>
                  <th className="h-11 px-3 text-left font-medium text-muted-foreground">
                    Measure
                  </th>
                  <th className="h-11 px-3 text-right font-medium text-muted-foreground">
                    Weight
                  </th>
                  {canEdit && (
                    <th className="h-11 px-3 text-right font-medium text-muted-foreground">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: canEdit ? 4 : 3 }).map((_, j) => (
                        <td key={j} className="px-3 py-3">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !kraData?.items.length ? (
                  <tr>
                    <td
                      colSpan={canEdit ? 4 : 3}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      {isEmployeeOnly
                        ? "No KRAs assigned yet. Contact your manager or HR."
                        : "No KRAs configured. Add KRAs and ensure total weight equals 100%."}
                    </td>
                  </tr>
                ) : (
                  kraData.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/50 hover:bg-muted/20"
                    >
                      <td className="px-3 py-3 font-medium">{item.name}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.measure}</td>
                      <td className="px-3 py-3 text-right font-semibold">{item.weight}%</td>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit KRA" : "Add KRA"}</DialogTitle>
            <DialogDescription>
              Set KRA Name, Measure, and Weight (%)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kra-name">KRA Name</Label>
              <Input
                id="kra-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Sales Target Achievement"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kra-measure">Measure</Label>
              <Input
                id="kra-measure"
                value={formMeasure}
                onChange={(e) => setFormMeasure(e.target.value)}
                placeholder="e.g. Achieve 100% of monthly sales quota"
              />
            </div>
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
                placeholder="e.g. 25"
              />
            </div>
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
