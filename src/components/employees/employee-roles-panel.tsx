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
  DialogDescription,
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
  isSystem: boolean;
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

  const { data: availableRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["roles-assignable"],
    queryFn: () =>
      apiFetchArray<AssignableRole>("/api/roles?status=ACTIVE&forAssignment=true"),
    enabled: canManage && !!employeeId,
  });

  const assignedRoleIds = new Set(
    assignments
      .filter((a) => !a.effectiveTo || new Date(a.effectiveTo) >= new Date())
      .map((a) => a.customRole.id)
  );

  const assignableOptions = availableRoles.filter(
    (r) => !r.isSystem && r.status === "ACTIVE" && !assignedRoleIds.has(r.id)
  );

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
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>Custom Roles</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Additional roles (CEO, Delivery Manager, etc.) — separate from the system Role field
            above.
          </p>
        </div>
        {canManage && !readOnly && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["roles-assignable"] });
              setAssignOpen(true);
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Assign Role
          </Button>
        )}
      </div>

      {activeAssignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No custom roles assigned yet. Use Assign Role to add CEO, Delivery Manager, Project
          Manager, or any role created under Settings → Roles.
        </p>
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
            <DialogTitle>Assign Custom Role</DialogTitle>
            <DialogDescription>
              Pick a role created in Settings → Roles & Permissions. System roles (Admin, HR,
              Manager, Employee) are set via the Role field above.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      rolesLoading
                        ? "Loading roles..."
                        : assignableOptions.length
                          ? "Select role"
                          : "No roles available — create one in Settings"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {assignableOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!rolesLoading && assignableOptions.length === 0 && (
                <p className="text-xs text-amber-600">
                  No custom roles found. Go to Settings → Roles & Permissions to create roles,
                  then run <code className="text-xs">npm run db:seed</code> if the list is empty.
                </p>
              )}
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
              disabled={!roleId || assignMutation.isPending || assignableOptions.length === 0}
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
