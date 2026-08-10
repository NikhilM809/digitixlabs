"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Target,
  Plus,
  Loader2,
  Save,
  Send,
  CheckCircle2,
  History,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  canAccessKra,
  canReviewKra,
  canReopenKra,
  isAdminOrHr,
} from "@/lib/permissions";
import { apiFetch, apiFetchArray } from "@/lib/client-api";
import {
  KRA_RATING_LABELS,
  KRA_STATUS_LABELS,
  formatKraPeriod,
  isKraLockedForEmployee,
  isKraLockedForManager,
} from "@/lib/kra";
import type { KraStatus } from "@prisma/client";

interface KraItem {
  id: string;
  goal: string;
  description?: string | null;
  target?: string | null;
  achievement?: string | null;
  employeeComments?: string | null;
  employeeRating?: number | null;
  managerRating?: number | null;
  managerComments?: string | null;
  sortOrder: number;
}

interface KraReview {
  id: string;
  userId: string;
  managerId?: string | null;
  month: number;
  year: number;
  status: KraStatus;
  employeeSubmittedAt?: string | null;
  managerReviewedAt?: string | null;
  avgEmployeeRating?: number | null;
  avgManagerRating?: number | null;
  user: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    managerId?: string | null;
    department?: { name: string } | null;
  };
  manager?: { id: string; firstName: string; lastName: string } | null;
  items: KraItem[];
}

type DraftItem = {
  goal: string;
  description: string;
  target: string;
  achievement: string;
  employeeComments: string;
  employeeRating: string;
  managerRating: string;
  managerComments: string;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: formatKraPeriod(i + 1, new Date().getFullYear()).split(" ")[0],
}));

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => currentYear - i);

function emptyItem(): DraftItem {
  return {
    goal: "",
    description: "",
    target: "",
    achievement: "",
    employeeComments: "",
    employeeRating: "",
    managerRating: "",
    managerComments: "",
  };
}

function itemsToDraft(items: KraItem[]): DraftItem[] {
  return items.map((i) => ({
    goal: i.goal,
    description: i.description ?? "",
    target: i.target ?? "",
    achievement: i.achievement ?? "",
    employeeComments: i.employeeComments ?? "",
    employeeRating: i.employeeRating?.toString() ?? "",
    managerRating: i.managerRating?.toString() ?? "",
    managerComments: i.managerComments ?? "",
  }));
}

function statusVariant(status: KraStatus): "secondary" | "warning" | "success" | "outline" {
  if (status === "DRAFT") return "secondary";
  if (status === "COMPLETED") return "success";
  if (status === "UNDER_MANAGER_REVIEW" || status === "EMPLOYEE_SUBMITTED") return "warning";
  return "outline";
}

export default function KraPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const reviewIdParam = searchParams.get("id");

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([emptyItem()]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(reviewIdParam);

  const canAccess = role ? canAccessKra(role) : false;
  const isReviewer = role ? canReviewKra(role) : false;
  const canReopen = role ? canReopenKra(role) : false;

  const { data: myReviews = [], isLoading: listLoading } = useQuery({
    queryKey: ["kra-list", userId],
    queryFn: () => apiFetchArray<KraReview>("/api/kra"),
    enabled: !!userId && canAccess,
  });

  const { data: teamReviews = [] } = useQuery({
    queryKey: ["kra-team", userId],
    queryFn: () => apiFetchArray<KraReview>("/api/kra?team=true"),
    enabled: !!userId && isReviewer,
  });

  const activeReviewId = selectedReviewId ?? myReviews.find(
    (r) => r.month === month && r.year === year
  )?.id;

  const { data: activeReview, isLoading: reviewLoading } = useQuery({
    queryKey: ["kra-review", activeReviewId],
    queryFn: () => apiFetch<KraReview>(`/api/kra/${activeReviewId}`),
    enabled: !!activeReviewId,
  });

  useEffect(() => {
    if (activeReview?.items) {
      setDraftItems(itemsToDraft(activeReview.items));
    }
  }, [activeReview?.id, activeReview?.items]);

  useEffect(() => {
    if (reviewIdParam) setSelectedReviewId(reviewIdParam);
  }, [reviewIdParam]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<KraReview>("/api/kra", {
        method: "POST",
        body: JSON.stringify({ month, year }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["kra-list"] });
      setSelectedReviewId(data.id);
      toast.success("KRA created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: (submit: boolean) => {
      const payload = {
        items: draftItems.map((item, index) => ({
          goal: item.goal,
          description: item.description || undefined,
          target: item.target || undefined,
          achievement: item.achievement || undefined,
          employeeComments: item.employeeComments || undefined,
          employeeRating: item.employeeRating ? Number(item.employeeRating) : undefined,
          sortOrder: index,
        })),
      };
      const url = submit
        ? `/api/kra/${activeReviewId}/submit`
        : `/api/kra/${activeReviewId}`;
      return apiFetch(url, {
        method: submit ? "POST" : "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_, submit) => {
      queryClient.invalidateQueries({ queryKey: ["kra-list"] });
      queryClient.invalidateQueries({ queryKey: ["kra-review", activeReviewId] });
      queryClient.invalidateQueries({ queryKey: ["kra-team"] });
      toast.success(submit ? "KRA submitted for manager review" : "Draft saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/kra/${activeReviewId}/review`, {
        method: "POST",
        body: JSON.stringify({
          items: activeReview!.items.map((item, index) => ({
            id: item.id,
            managerRating: Number(draftItems[index]?.managerRating),
            managerComments: draftItems[index]?.managerComments || undefined,
          })),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kra-list"] });
      queryClient.invalidateQueries({ queryKey: ["kra-review", activeReviewId] });
      queryClient.invalidateQueries({ queryKey: ["kra-team"] });
      toast.success("Manager review completed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reopenMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/kra/${activeReviewId}/reopen`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kra-list"] });
      queryClient.invalidateQueries({ queryKey: ["kra-review", activeReviewId] });
      toast.success("KRA reopened to draft");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isOwner = activeReview?.userId === userId;
  const isAssignedManager =
    activeReview?.managerId === userId ||
    (role === "MANAGER" && activeReview?.user.managerId === userId);
  const employeeLocked = activeReview ? isKraLockedForEmployee(activeReview) : false;
  const managerLocked = activeReview ? isKraLockedForManager(activeReview) : false;

  const historyReviews = useMemo(
    () => [...myReviews].sort((a, b) => b.year - a.year || b.month - a.month),
    [myReviews]
  );

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        You do not have access to KRA.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Target className="h-7 w-7 text-brand-600" />
          Key Result Areas (KRA)
        </h1>
        <p className="text-muted-foreground mt-1">
          Monthly goals, self-assessment, and manager review
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card glass>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                My KRA History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {listLoading ? (
                <Skeleton className="h-20 rounded-xl" />
              ) : historyReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No KRA records yet.</p>
              ) : (
                historyReviews.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedReviewId(r.id);
                      setMonth(r.month);
                      setYear(r.year);
                    }}
                    className={`w-full text-left rounded-xl border p-3 transition-colors ${
                      activeReviewId === r.id
                        ? "border-brand-500 bg-brand-500/10"
                        : "border-border/50 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{formatKraPeriod(r.month, r.year)}</span>
                      <Badge variant={statusVariant(r.status)} className="text-xs">
                        {KRA_STATUS_LABELS[r.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Self: {r.avgEmployeeRating ?? "-"} · Manager: {r.avgManagerRating ?? "-"}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {isReviewer && teamReviews.length > 0 && (
            <Card glass>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Team Reviews Pending</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                {teamReviews
                  .filter((r) => r.status === "UNDER_MANAGER_REVIEW" && r.userId !== userId)
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReviewId(r.id)}
                      className="w-full text-left rounded-xl border border-border/50 p-3 hover:bg-muted/30"
                    >
                      <p className="font-medium text-sm">
                        {r.user.firstName} {r.user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatKraPeriod(r.month, r.year)} · Self: {r.avgEmployeeRating ?? "-"}
                      </p>
                    </button>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card glass>
            <CardHeader>
              <CardTitle className="text-base">Select Period</CardTitle>
              <CardDescription>Create or open KRA for a month</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label>Month</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {formatKraPeriod(m.value, year).split(" ")[0]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-28">
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
              {!activeReviewId && (
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create KRA
                </Button>
              )}
            </CardContent>
          </Card>

          {reviewLoading && activeReviewId ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : activeReview ? (
            <Card glass>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>
                      {isOwner ? "My KRA" : `${activeReview.user.firstName} ${activeReview.user.lastName}`}
                    </CardTitle>
                    <CardDescription>
                      {formatKraPeriod(activeReview.month, activeReview.year)}
                      {activeReview.user.department && ` · ${activeReview.user.department.name}`}
                    </CardDescription>
                  </div>
                  <Badge variant={statusVariant(activeReview.status)}>
                    {KRA_STATUS_LABELS[activeReview.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {draftItems.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">KRA {index + 1}</h3>
                      {isOwner && !employeeLocked && draftItems.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDraftItems((items) => items.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Goal / KRA</Label>
                      <Input
                        value={item.goal}
                        disabled={!isOwner || employeeLocked}
                        onChange={(e) => {
                          const next = [...draftItems];
                          next[index] = { ...next[index], goal: e.target.value };
                          setDraftItems(next);
                        }}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Target</Label>
                        <Textarea
                          value={item.target}
                          disabled={!isOwner || employeeLocked}
                          rows={2}
                          onChange={(e) => {
                            const next = [...draftItems];
                            next[index] = { ...next[index], target: e.target.value };
                            setDraftItems(next);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Achievement</Label>
                        <Textarea
                          value={item.achievement}
                          disabled={!isOwner || employeeLocked}
                          rows={2}
                          onChange={(e) => {
                            const next = [...draftItems];
                            next[index] = { ...next[index], achievement: e.target.value };
                            setDraftItems(next);
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Employee Comments</Label>
                      <Textarea
                        value={item.employeeComments}
                        disabled={!isOwner || employeeLocked}
                        rows={2}
                        onChange={(e) => {
                          const next = [...draftItems];
                          next[index] = { ...next[index], employeeComments: e.target.value };
                          setDraftItems(next);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Employee Self Rating (1–5)</Label>
                      <Select
                        value={item.employeeRating}
                        disabled={!isOwner || employeeLocked}
                        onValueChange={(v) => {
                          const next = [...draftItems];
                          next[index] = { ...next[index], employeeRating: v };
                          setDraftItems(next);
                        }}
                      >
                        <SelectTrigger className="max-w-xs">
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((r) => (
                            <SelectItem key={r} value={String(r)}>
                              {r} – {KRA_RATING_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {(employeeLocked || isAssignedManager || isAdminOrHr(role!)) && (
                      <div className="pt-3 border-t border-border/50 space-y-3">
                        <p className="text-sm font-medium text-muted-foreground">Manager Review</p>
                        <div className="space-y-2">
                          <Label>Manager Rating (1–5)</Label>
                          <Select
                            value={item.managerRating}
                            disabled={!(isAssignedManager || isAdminOrHr(role!)) || managerLocked}
                            onValueChange={(v) => {
                              const next = [...draftItems];
                              next[index] = { ...next[index], managerRating: v };
                              setDraftItems(next);
                            }}
                          >
                            <SelectTrigger className="max-w-xs">
                              <SelectValue placeholder="Select rating" />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5].map((r) => (
                                <SelectItem key={r} value={String(r)}>
                                  {r} – {KRA_RATING_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Manager Comments</Label>
                          <Textarea
                            value={item.managerComments}
                            disabled={!(isAssignedManager || isAdminOrHr(role!)) || managerLocked}
                            rows={2}
                            onChange={(e) => {
                              const next = [...draftItems];
                              next[index] = { ...next[index], managerComments: e.target.value };
                              setDraftItems(next);
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isOwner && !employeeLocked && (
                  <Button
                    variant="outline"
                    onClick={() => setDraftItems((items) => [...items, emptyItem()])}
                  >
                    <Plus className="h-4 w-4" />
                    Add KRA Item
                  </Button>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {isOwner && !employeeLocked && (
                    <>
                      <Button
                        variant="outline"
                        disabled={saveMutation.isPending}
                        onClick={() => saveMutation.mutate(false)}
                      >
                        <Save className="h-4 w-4" />
                        Save Draft
                      </Button>
                      <Button
                        disabled={saveMutation.isPending}
                        onClick={() => saveMutation.mutate(true)}
                      >
                        <Send className="h-4 w-4" />
                        Submit KRA
                      </Button>
                    </>
                  )}
                  {(isAssignedManager || isAdminOrHr(role!)) &&
                    !managerLocked &&
                    activeReview.status === "UNDER_MANAGER_REVIEW" && (
                      <Button
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate()}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Complete Review
                      </Button>
                    )}
                  {canReopen && activeReview.status !== "DRAFT" && (
                    <Button
                      variant="outline"
                      disabled={reopenMutation.isPending}
                      onClick={() => reopenMutation.mutate()}
                    >
                      Reopen to Draft
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card glass>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a period and create a KRA to get started.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
