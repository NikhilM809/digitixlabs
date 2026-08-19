"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, apiFetchArray } from "@/lib/client-api";

interface RoleAssignment {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  customRole: {
    id: string;
    name: string;
    code: string;
    status: string;
    isSystem: boolean;
    department: { name: string } | null;
  };
  assignedBy: { firstName: string; lastName: string } | null;
}

interface AssignableRole {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface EmployeeRolesPanelProps {
  employeeId: string;
  canManage?: boolean;
  readOnly?: boolean;
}

export function EmployeeRolesPanel({
  employeeId,
  canManage = false,
  readOnly = false,
}: EmployeeRolesPanelProps) {
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [effectiveTo, setEffectiveTo] = useState("");

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["employee-roles", employeeId],
    queryFn: () => apiFetchArray<RoleAssignment>(`/api/employees/${employeeId}/roles`),
    enabled: !!employeeId,
  });

  const { data: availableRoles = [] } = useQuery({
    queryKey: ["roles-active"],
    queryFn: () => apiFetchArray<AssignableRole>("/api/roles?status=ACTIVE"),
    enabled: assignOpen && canManage,
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/employees/${employeeId}/roles`, {
        method: "POST",
        body: JSON.stringify({
          customRoleId: roleId,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Role assigned");
      queryClient.invalidateQueries({ queryKey: ["employee-roles", employeeId] });
      setAssignOpen(false);
      setRoleId("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch(`/api/employees/${employeeId}/roles/${assignmentId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Role removed");
      queryClient.invalidateQueries({ queryKey: ["employee-roles", employeeId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const activeAssignments = assignments.filter(
    (a) => !a.effectiveTo || new Date(a.effectiveTo) >= new Date()
  );

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading roles...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Custom Roles</Label>
        {canManage && !readOnly && (
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Assign Role
          </Button>
        )}
      </div>

      {activeAssignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom roles assigned.</p>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-border/50 p-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.customRole.name}</span>
                  {a.customRole.isSystem && (
                    <Badge variant="secondary" className="text-[10px]">
                      System
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">{a.customRole.code}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Effective: {format(new Date(a.effectiveFrom), "dd MMM yyyy")}
                  {a.effectiveTo
                    ? ` → ${format(new Date(a.effectiveTo), "dd MMM yyyy")}`
                    : " → ongoing"}
                </p>
                {a.assignedBy && (
                  <p className="text-xs text-muted-foreground">
                    Assigned by {a.assignedBy.firstName} {a.assignedBy.lastName}
                  </p>
                )}
              </div>
              {canManage && !readOnly && !a.customRole.isSystem && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Remove role "${a.customRole.name}"?`)) {
                      removeMutation.mutate(a.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles
                    .filter((r) => !r.code.startsWith("ADMIN") || r.code === "CEO")
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Effective From</Label>
                <Input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Effective To (optional)</Label>
                <Input
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!roleId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
