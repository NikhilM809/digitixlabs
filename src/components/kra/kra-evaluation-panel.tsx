"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  Save,
  Send,
  CheckCircle2,
  Plus,
  History,
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
  canReviewKra,
  canReopenKra,
  isAdminOrHr,
} from "@/lib/permissions";
import { apiFetch, apiFetchArray } from "@/lib/client-api";
import {
  KRA_STATUS_LABELS,
  formatKraPeriod,
  isKraLockedForEmployee,
  isKraLockedForManager,
} from "@/lib/kra";
import { formatKraWeight } from "@/lib/employee-kra";
import type { KraStatus } from "@prisma/client";

interface KraReviewItem {
  id: string;
  name: string;
  measure: string | null;
  weight: number;
  employeePercentage: number | null;
  managerPercentage: number | null;
  employeeComments: string | null;
  managerComments: string | null;
  sortOrder: number;
}

interface KraReview {
  id: string;
  userId: string;
  month: number;
  year: number;
  status: KraStatus;
  avgEmployeePercentage?: number | null;
  avgManagerPercentage?: number | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId?: string;
  };
  items: KraReviewItem[];
}

interface EmployeeOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: formatKraPeriod(i + 1, new Date().getFullYear()).split(" ")[0],
}));

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => currentYear - i);

type DraftPct = Record<string, string>;

interface KraEvaluationPanelProps {
  configFinalized: boolean;
  selectedEmployeeId?: string;
  isConfigurator: boolean;
}

export function KraEvaluationPanel({
  configFinalized,
  selectedEmployeeId,
  isConfigurator,
}: KraEvaluationPanelProps) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const isEmployee = role === "EMPLOYEE";
  const targetUserId = isEmployee ? userId! : selectedEmployeeId;

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(
    searchParams.get("id")
  );
  const [employeePct, setEmployeePct] = useState<DraftPct>({});
  const [managerPct, setManagerPct] = useState<DraftPct>({});

  const { data: history = [] } = useQuery({
    queryKey: ["kra-reviews", targetUserId, isEmployee ? "self" : "managed"],
    queryFn: () =>
      apiFetchArray<KraReview>(
        isEmployee
          ? "/api/kra"
          : `/api/kra?userId=${targetUserId}`
      ),
    enabled: !!targetUserId && !!role,
  });

  const { data: teamPending = [] } = useQuery({
    queryKey: ["kra-team-pending"],
    queryFn: () => apiFetchArray<KraReview>("/api/kra?team=true"),
    enabled: !!role && canReviewKra(role) && !isEmployee,
  });

  const { data: activeReview, isLoading: reviewLoading } = useQuery({
    queryKey: ["kra-review", activeReviewId],
    queryFn: () => apiFetch<KraReview>(`/api/kra/${activeReviewId}`),
    enabled: !!activeReviewId,
  });

  useEffect(() => {
    if (!activeReview) return;
    const emp: DraftPct = {};
    const mgr: DraftPct = {};
    for (const item of activeReview.items) {
      emp[item.id] =
        item.employeePercentage !== null && item.employeePercentage !== undefined
          ? String(item.employeePercentage)
          : "";
      mgr[item.id] =
        item.managerPercentage !== null && item.managerPercentage !== undefined
          ? String(item.managerPercentage)
          : "";
    }
    setEmployeePct(emp);
    setManagerPct(mgr);
  }, [activeReview]);

  const periodReview = useMemo(
    () => history.find((r) => r.month === month && r.year === year),
    [history, month, year]
  );

  useEffect(() => {
    if (periodReview) {
      setActiveReviewId(periodReview.id);
    }
  }, [periodReview?.id]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["kra-reviews"] });
    queryClient.invalidateQueries({ queryKey: ["kra-review", activeReviewId] });
    queryClient.invalidateQueries({ queryKey: ["kra-team-pending"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<KraReview>("/api/kra", {
        method: "POST",
        body: JSON.stringify({
          month,
          year,
          userId: isEmployee ? undefined : targetUserId,
        }),
      }),
    onSuccess: (data) => {
      toast.success("KRA evaluation started");
      setActiveReviewId(data.id);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!activeReview) throw new Error("No active review");
      return apiFetch<KraReview>(`/api/kra/${activeReview.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          items: activeReview.items.map((item) => ({
            id: item.id,
            employeePercentage: employeePct[item.id]
              ? parseFloat(employeePct[item.id])
              : null,
            employeeComments: item.employeeComments,
          })),
        }),
      });
    },
    onSuccess: () => {
      toast.success("Draft saved");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!activeReview) throw new Error("No active review");
      return apiFetch<KraReview>(`/api/kra/${activeReview.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          items: activeReview.items.map((item) => ({
            id: item.id,
            employeePercentage: employeePct[item.id]
              ? parseFloat(employeePct[item.id])
              : null,
          })),
        }),
      });
    },
    onSuccess: () => {
      toast.success("Submitted to manager for review");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!activeReview) throw new Error("No active review");
      return apiFetch<KraReview>(`/api/kra/${activeReview.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          items: activeReview.items.map((item) => ({
            id: item.id,
            managerPercentage: managerPct[item.id]
              ? parseFloat(managerPct[item.id])
              : null,
          })),
        }),
      });
    },
    onSuccess: () => {
      toast.success("Manager review completed");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reopenMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/kra/${activeReviewId}/reopen`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Evaluation reopened");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!targetUserId && !isEmployee) {
    return (
      <Card glass>
        <CardContent className="py-10 text-center text-muted-foreground">
          Select an employee in KRA Setup to view or manage their evaluation.
        </CardContent>
      </Card>
    );
  }

  if (!configFinalized && isEmployee) {
    return (
      <Card glass>
        <CardContent className="py-10 text-center text-muted-foreground">
          Your KRAs are not finalized yet. Admin or Manager must complete KRA setup first.
        </CardContent>
      </Card>
    );
  }

  const canEditEmployee =
    isEmployee &&
    activeReview &&
    !isKraLockedForEmployee(activeReview);
  const canEditManager =
    role &&
    canReviewKra(role) &&
    activeReview &&
    !isKraLockedForManager(activeReview) &&
    activeReview.status !== "DRAFT";

  return (
    <div className="space-y-6">
      {!isEmployee && teamPending.length > 0 && (
        <Card glass>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              Pending Manager Review
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {teamPending.map((r) => (
              <Button
                key={r.id}
                variant={activeReviewId === r.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveReviewId(r.id)}
              >
                {r.user.firstName} {r.user.lastName} — {formatKraPeriod(r.month, r.year)}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Performance Evaluation</CardTitle>
          <CardDescription>
            Employee enters <strong>Your %</strong>; Manager/Admin enters <strong>Manager/Lead %</strong> after discussion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label>Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!periodReview && configFinalized && (isEmployee || isConfigurator) && (
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Start Evaluation
              </Button>
            )}
            {activeReview && (
              <Badge variant="outline">
                {KRA_STATUS_LABELS[activeReview.status]}
              </Badge>
            )}
          </div>

          {reviewLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !activeReview ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {configFinalized
                ? "No evaluation for this period. Click Start Evaluation."
                : "Finalize KRA setup before starting evaluation."}
            </p>
          ) : (
            <>
              {(activeReview.avgEmployeePercentage != null ||
                activeReview.avgManagerPercentage != null) && (
                <div className="flex flex-wrap gap-4 text-sm rounded-xl border border-border/50 bg-muted/20 p-3">
                  {activeReview.avgEmployeePercentage != null && (
                    <span>
                      Overall (Employee):{" "}
                      <strong>{activeReview.avgEmployeePercentage}%</strong>
                    </span>
                  )}
                  {activeReview.avgManagerPercentage != null && (
                    <span>
                      Overall (Manager):{" "}
                      <strong>{activeReview.avgManagerPercentage}%</strong>
                    </span>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="px-2 py-2 text-left text-muted-foreground w-10">#</th>
                      <th className="px-2 py-2 text-left text-muted-foreground">KRA</th>
                      <th className="px-2 py-2 text-left text-muted-foreground min-w-[180px]">Measure</th>
                      <th className="px-2 py-2 text-right text-muted-foreground w-16">Weight</th>
                      <th className="px-2 py-2 text-right text-muted-foreground w-24">Your %</th>
                      <th className="px-2 py-2 text-right text-muted-foreground w-28">Manager/Lead %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReview.items.map((item, index) => (
                      <tr key={item.id} className="border-b border-border/50 align-top">
                        <td className="px-2 py-2 text-muted-foreground">{index + 1}</td>
                        <td className="px-2 py-2 font-medium">{item.name}</td>
                        <td className="px-2 py-2 text-muted-foreground text-xs whitespace-pre-wrap">
                          {item.measure ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-right">{formatKraWeight(item.weight)}</td>
                        <td className="px-2 py-2 text-right">
                          {canEditEmployee && item.weight > 0 ? (
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="h-8 w-20 ml-auto text-right"
                              value={employeePct[item.id] ?? ""}
                              onChange={(e) =>
                                setEmployeePct((p) => ({ ...p, [item.id]: e.target.value }))
                              }
                            />
                          ) : (
                            <span>
                              {item.employeePercentage != null
                                ? `${item.employeePercentage}%`
                                : "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {canEditManager && item.weight > 0 ? (
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="h-8 w-20 ml-auto text-right"
                              value={managerPct[item.id] ?? ""}
                              onChange={(e) =>
                                setManagerPct((p) => ({ ...p, [item.id]: e.target.value }))
                              }
                            />
                          ) : (
                            <span>
                              {item.managerPercentage != null
                                ? `${item.managerPercentage}%`
                                : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {canEditEmployee && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Draft
                    </Button>
                    <Button
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending}
                    >
                      {submitMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Submit to Manager
                    </Button>
                  </>
                )}
                {canEditManager && (
                  <Button
                    onClick={() => reviewMutation.mutate()}
                    disabled={reviewMutation.isPending}
                  >
                    {reviewMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Complete Manager Review
                  </Button>
                )}
                {role && canReopenKra(role) && activeReview.status !== "DRAFT" && (
                  <Button
                    variant="outline"
                    onClick={() => reopenMutation.mutate()}
                    disabled={reopenMutation.isPending}
                  >
                    Reopen Evaluation
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
