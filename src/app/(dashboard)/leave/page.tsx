"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarDays,
  FileText,
  Wallet,
  ClipboardCheck,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/activity-feed";
import { fetchApi } from "@/lib/api-client";
import { leaveApplicationSchema, type LeaveApplicationInput } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { isManager } from "@/lib/roles";

interface LeaveType {
  id: string;
  name: string;
  code: string;
}

interface LeaveRequest {
  id: string;
  userId: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  isHalfDay: boolean;
  halfDayPeriod?: string | null;
  managerComment?: string | null;
  createdAt: string;
  leaveType: { id: string; name: string; code: string };
  approvedBy?: { firstName: string; lastName: string } | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    department?: { name: string } | null;
  };
}

interface LeaveBalanceItem {
  leaveType: { id: string; name: string; code: string; isPaid: boolean };
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
}

const statusVariant: Record<string, "warning" | "success" | "destructive" | "secondary"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  CANCELLED: "secondary",
};

function ApplyLeaveForm({ leaveTypes }: { leaveTypes: LeaveType[] }) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<LeaveApplicationInput>({
    resolver: zodResolver(leaveApplicationSchema) as Resolver<LeaveApplicationInput>,
    defaultValues: { isHalfDay: false },
  });

  const isHalfDay = watch("isHalfDay");

  const mutation = useMutation({
    mutationFn: (data: LeaveApplicationInput) =>
      fetchApi("/api/leave", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success("Leave request submitted successfully");
      reset();
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balance"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card glass>
      <CardHeader>
        <CardTitle>Apply for Leave</CardTitle>
        <CardDescription>Submit a new leave request for approval</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Leave Type</Label>
            <Controller
              name="leaveTypeId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.leaveTypeId && (
              <p className="text-sm text-destructive">{errors.leaveTypeId.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fromDate">From Date</Label>
              <Input id="fromDate" type="date" {...register("fromDate")} />
              {errors.fromDate && (
                <p className="text-sm text-destructive">{errors.fromDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="toDate">To Date</Label>
              <Input id="toDate" type="date" {...register("toDate")} />
              {errors.toDate && (
                <p className="text-sm text-destructive">{errors.toDate.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Controller
              name="isHalfDay"
              control={control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label>Half Day Leave</Label>
          </div>

          {isHalfDay && (
            <div className="space-y-2">
              <Label>Half Day Period</Label>
              <Controller
                name="halfDayPeriod"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FIRST_HALF">First Half</SelectItem>
                      <SelectItem value="SECOND_HALF">Second Half</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Describe the reason for your leave..."
              {...register("reason")}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyContact">Emergency Contact (optional)</Label>
            <Input
              id="emergencyContact"
              placeholder="Contact number during leave"
              {...register("emergencyContact")}
            />
          </div>

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Leave Request"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LeaveRow({ leave }: { leave: LeaveRequest }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/30 p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{leave.leaveType.name}</p>
          <Badge variant={statusVariant[leave.status]}>{leave.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(leave.fromDate)}
          {!leave.isHalfDay && leave.fromDate !== leave.toDate && ` — ${formatDate(leave.toDate)}`}
          {leave.isHalfDay && ` (${leave.halfDayPeriod?.replace("_", " ")})`}
        </p>
        <p className="text-xs text-muted-foreground">
          {leave.totalDays} day{leave.totalDays !== 1 ? "s" : ""} · Applied {formatDate(leave.createdAt)}
        </p>
        {leave.managerComment && (
          <p className="text-xs text-muted-foreground italic">Comment: {leave.managerComment}</p>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm truncate max-w-[200px]">{leave.reason}</p>
      </div>
    </div>
  );
}

function PendingApprovalRow({ leave }: { leave: LeaveRequest }) {
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ action }: { action: "approve" | "reject" }) =>
      fetchApi(`/api/leave/${leave.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, managerComment: comment || undefined }),
      }),
    onSuccess: (_, { action }) => {
      toast.success(`Leave ${action === "approve" ? "approved" : "rejected"}`);
      queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balance"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {leave.user?.firstName} {leave.user?.lastName}
            <span className="text-muted-foreground font-normal ml-2">
              ({leave.user?.employeeId})
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {leave.leaveType.name} · {formatDate(leave.fromDate)} — {formatDate(leave.toDate)} ·{" "}
            {leave.totalDays} day{leave.totalDays !== 1 ? "s" : ""}
          </p>
          {leave.user?.department && (
            <p className="text-xs text-muted-foreground">{leave.user.department.name}</p>
          )}
          <p className="text-sm mt-1">{leave.reason}</p>
        </div>
        <Badge variant="warning">Pending</Badge>
      </div>
      <Input
        placeholder="Add a comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => mutation.mutate({ action: "approve" })}
          disabled={mutation.isPending}
        >
          <Check className="h-4 w-4" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => mutation.mutate({ action: "reject" })}
          disabled={mutation.isPending}
        >
          <X className="h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}

export default function LeavePage() {
  const { data: session } = useSession();
  const isMgr = session?.user?.role ? isManager(session.user.role) : false;
  const userId = session?.user?.id;

  const { data: leaveTypes, isLoading: typesLoading } = useQuery({
    queryKey: ["leave-types"],
    queryFn: () => fetchApi<LeaveType[]>("/api/leave-types"),
  });

  const { data: leavesData, isLoading: leavesLoading } = useQuery({
    queryKey: ["leaves"],
    queryFn: () =>
      fetchApi<{ leaves: LeaveRequest[] }>("/api/leave?limit=100"),
  });

  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ["leave-balance"],
    queryFn: () =>
      fetchApi<{ balances: LeaveBalanceItem[]; year: number }>("/api/leave/balance"),
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-leaves"],
    queryFn: () =>
      fetchApi<{ leaves: LeaveRequest[] }>("/api/leave?status=PENDING&limit=100"),
    enabled: isMgr,
  });

  const myLeaves = leavesData?.leaves.filter((l) => l.userId === userId) ?? [];
  const pendingLeaves =
    pendingData?.leaves.filter((l) => l.userId !== userId && l.status === "PENDING") ?? [];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
        <p className="text-muted-foreground mt-1">
          Apply for leave, track requests, and manage approvals
        </p>
      </motion.div>

      <Tabs defaultValue="apply" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="apply" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Apply Leave
          </TabsTrigger>
          <TabsTrigger value="my-leaves" className="gap-2">
            <FileText className="h-4 w-4" />
            My Leaves
          </TabsTrigger>
          <TabsTrigger value="balance" className="gap-2">
            <Wallet className="h-4 w-4" />
            Leave Balance
          </TabsTrigger>
          {isMgr && (
            <TabsTrigger value="pending" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Pending Approvals
              {pendingLeaves.length > 0 && (
                <Badge variant="warning" className="ml-1">
                  {pendingLeaves.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="apply">
          {typesLoading ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : leaveTypes && leaveTypes.length > 0 ? (
            <ApplyLeaveForm leaveTypes={leaveTypes} />
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No leave types available"
              description="Contact HR to configure leave types."
            />
          )}
        </TabsContent>

        <TabsContent value="my-leaves">
          <Card glass>
            <CardHeader>
              <CardTitle>My Leave Requests</CardTitle>
              <CardDescription>History of all your leave applications</CardDescription>
            </CardHeader>
            <CardContent>
              {leavesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : myLeaves.length > 0 ? (
                <div className="space-y-3">
                  {myLeaves.map((leave) => (
                    <LeaveRow key={leave.id} leave={leave} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No leave requests"
                  description="You haven't applied for any leave yet."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {balanceLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))
            ) : balanceData?.balances && balanceData.balances.length > 0 ? (
              balanceData.balances.map((b, i) => (
                <motion.div
                  key={b.leaveType.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card glass className="h-full">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{b.leaveType.name}</CardTitle>
                        <Badge variant={b.leaveType.isPaid ? "success" : "secondary"}>
                          {b.leaveType.isPaid ? "Paid" : "Unpaid"}
                        </Badge>
                      </div>
                      <CardDescription>{b.leaveType.code}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-medium">{b.totalDays}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Used</span>
                          <span className="font-medium text-orange-600">{b.usedDays}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Pending</span>
                          <span className="font-medium text-amber-600">{b.pendingDays}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all"
                            style={{
                              width: `${b.totalDays > 0 ? (b.availableDays / b.totalDays) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <p className="text-lg font-bold text-brand-600">
                          {b.availableDays} days remaining
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full">
                <EmptyState
                  icon={Wallet}
                  title="No leave balance"
                  description="Your leave balance hasn't been configured yet."
                />
              </div>
            )}
          </div>
        </TabsContent>

        {isMgr && (
          <TabsContent value="pending">
            <Card glass>
              <CardHeader>
                <CardTitle>Pending Approvals</CardTitle>
                <CardDescription>Review and action leave requests from your team</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                  </div>
                ) : pendingLeaves.length > 0 ? (
                  <div className="space-y-4">
                    {pendingLeaves.map((leave) => (
                      <PendingApprovalRow key={leave.id} leave={leave} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={ClipboardCheck}
                    title="All caught up!"
                    description="No pending leave requests to review."
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
