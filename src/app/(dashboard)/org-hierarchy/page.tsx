"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Network,
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
  UserCog,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { UserStatus } from "@prisma/client";

interface OrgTreeNode {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  role: string;
  status: UserStatus;
  managerId: string | null;
  directReportCount: number;
  department: { name: string } | null;
  designation: { name: string } | null;
  children: OrgTreeNode[];
}

interface ManagerOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface HierarchyResponse {
  tree: OrgTreeNode[];
  employees: ManagerOption[];
}

interface EmployeeDetailResponse {
  employee: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    role: string;
    status: UserStatus;
    managerId: string | null;
    manager: {
      id: string;
      firstName: string;
      lastName: string;
      employeeId: string;
    } | null;
    teamMembers: Array<{
      id: string;
      employeeId: string;
      firstName: string;
      lastName: string;
      designation: { name: string } | null;
    }>;
  };
  history: Array<{
    id: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    manager: {
      id: string;
      firstName: string;
      lastName: string;
      employeeId: string;
    } | null;
  }>;
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  defaultExpanded,
}: {
  node: OrgTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (node: OrgTreeNode) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition-colors",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          isSelected
            ? "bg-brand-500/15 text-brand-700 dark:text-brand-300"
            : "hover:bg-muted/60"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span
            className="shrink-0 rounded p-0.5 hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        ) : (
          <span className="w-5" />
        )}
        <span className="font-medium truncate">
          {node.firstName} {node.lastName}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          ({node.employeeId})
        </span>
        {node.status !== "ACTIVE" && (
          <Badge variant="secondary" className="text-[10px]">
            {node.status}
          </Badge>
        )}
        {node.directReportCount > 0 && (
          <Badge variant="outline" className="ml-auto text-[10px]">
            {node.directReportCount} DR
          </Badge>
        )}
      </button>
      {expanded &&
        node.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export default function OrgHierarchyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = session?.user?.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OrgTreeNode | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [newManagerId, setNewManagerId] = useState<string>("none");
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const { data, isLoading } = useQuery({
    queryKey: ["org-hierarchy", search],
    queryFn: () =>
      apiFetch<HierarchyResponse>(
        `/api/org-hierarchy${search ? `?search=${encodeURIComponent(search)}` : ""}`
      ),
    enabled: status === "authenticated" && isAdmin,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["org-hierarchy-detail", selected?.id],
    queryFn: () =>
      apiFetch<EmployeeDetailResponse>(
        `/api/org-hierarchy?userId=${selected!.id}`
      ),
    enabled: !!selected?.id && isAdmin,
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/org-hierarchy", {
        method: "PATCH",
        body: JSON.stringify({
          userId: selected!.id,
          managerId: newManagerId === "none" ? null : newManagerId,
          effectiveFrom,
        }),
      }),
    onSuccess: () => {
      toast.success("Reporting manager updated");
      setAssignOpen(false);
      queryClient.invalidateQueries({ queryKey: ["org-hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["org-hierarchy-detail"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const managerOptions = useMemo(() => {
    if (!data?.employees || !selected) return [];
    return data.employees.filter((e) => e.id !== selected.id);
  }, [data?.employees, selected]);

  if (status === "loading") {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive/60 mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">
          Organization hierarchy is for administrators only.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Network className="h-7 w-7 text-brand-600" />
          Organization Hierarchy
        </h1>
        <p className="text-muted-foreground mt-1">
          View and manage reporting relationships. KRA, leave, and other workflows use the assigned manager.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card glass className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reporting Tree</CardTitle>
            <CardDescription>Click an employee to view or change their manager</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[520px] overflow-y-auto rounded-xl border border-border/50 p-2">
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !data?.tree.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No employees found.
                </p>
              ) : (
                data.tree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedId={selected?.id ?? null}
                    onSelect={setSelected}
                    defaultExpanded
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card glass className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Employee Details</CardTitle>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <p className="py-12 text-center text-muted-foreground">
                Select an employee from the tree to manage their reporting relationship.
              </p>
            ) : detailLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : detail ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">
                    {detail.employee.firstName} {detail.employee.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {detail.employee.employeeId} · {detail.employee.role}
                    {detail.employee.status !== "ACTIVE" && (
                      <Badge variant="secondary" className="ml-2">
                        {detail.employee.status}
                      </Badge>
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Current Manager</p>
                  <p className="font-medium">
                    {detail.employee.manager
                      ? `${detail.employee.manager.firstName} ${detail.employee.manager.lastName} (${detail.employee.manager.employeeId})`
                      : "None — top of hierarchy"}
                  </p>
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setNewManagerId(detail.employee.managerId ?? "none");
                      setAssignOpen(true);
                    }}
                  >
                    <UserCog className="h-4 w-4" />
                    Change Manager
                  </Button>
                </div>

                {detail.employee.teamMembers.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Direct Reports ({detail.employee.teamMembers.length})
                    </p>
                    <ul className="space-y-1 text-sm">
                      {detail.employee.teamMembers.map((m) => (
                        <li
                          key={m.id}
                          className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-muted/40"
                        >
                          <span>
                            {m.firstName} {m.lastName}
                          </span>
                          <span className="text-muted-foreground">
                            {m.designation?.name ?? m.employeeId}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detail.history.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Reporting History</p>
                    <div className="space-y-2">
                      {detail.history.map((h) => (
                        <div
                          key={h.id}
                          className="rounded-lg border border-border/50 px-3 py-2 text-sm"
                        >
                          <p>
                            {formatDate(h.effectiveFrom)}
                            {" — "}
                            {h.effectiveTo ? formatDate(h.effectiveTo) : "Present"}
                          </p>
                          <p className="text-muted-foreground">
                            Manager:{" "}
                            {h.manager
                              ? `${h.manager.firstName} ${h.manager.lastName}`
                              : "None"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Manager</DialogTitle>
            <DialogDescription>
              Assign or remove the reporting manager for {selected?.firstName}{" "}
              {selected?.lastName}. This updates KRA reviewer and other manager workflows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Manager</Label>
              <Select value={newManagerId} onValueChange={setNewManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager (top level)</SelectItem>
                  {managerOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.firstName} {m.lastName} ({m.employeeId}) — {m.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective-from">Effective From</Label>
              <Input
                id="effective-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAssignOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending}
              >
                {assignMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
