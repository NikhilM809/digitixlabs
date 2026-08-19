"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionMatrix, type PermissionItem } from "@/components/roles/permission-matrix";
import { apiFetch, apiFetchArray } from "@/lib/client-api";
import { generateRoleCode } from "@/lib/role-utils";
import type { CustomRoleInput } from "@/lib/validations";

interface Department {
  id: string;
  name: string;
}

interface Manager {
  id: string;
  firstName: string;
  lastName: string;
}

interface RoleOption {
  id: string;
  name: string;
  code: string;
}

export interface RoleRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  isSystem: boolean;
  departmentId: string | null;
  managerId: string | null;
  parentRoleId: string | null;
  hierarchyLevel: number;
  department: { id: string; name: string } | null;
  permissions?: Array<{ permission: PermissionItem }>;
}

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRole: RoleRecord | null;
}

export function RoleFormDialog({ open, onOpenChange, editingRole }: RoleFormDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("none");
  const [managerId, setManagerId] = useState<string>("none");
  const [parentRoleId, setParentRoleId] = useState<string>("none");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [hierarchyLevel, setHierarchyLevel] = useState(0);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [autoCode, setAutoCode] = useState(true);

  const { data: permissions = [] } = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: async () => {
      const res = await apiFetch<{ permissions: PermissionItem[] }>("/api/permissions");
      return res.permissions;
    },
    enabled: open,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiFetchArray<Department>("/api/departments"),
    enabled: open,
  });

  const { data: managers = [] } = useQuery({
    queryKey: ["employees-active"],
    queryFn: () =>
      apiFetchArray<Manager>("/api/employees?activeOnly=true&role=MANAGER"),
    enabled: open,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles-options"],
    queryFn: () => apiFetchArray<RoleOption>("/api/roles"),
    enabled: open,
  });

  const { data: roleDetail } = useQuery({
    queryKey: ["role-detail", editingRole?.id],
    queryFn: () => apiFetch<RoleRecord & { permissions: Array<{ permission: PermissionItem }> }>(
      `/api/roles/${editingRole!.id}`
    ),
    enabled: open && !!editingRole?.id,
  });

  useEffect(() => {
    if (!open) return;
    if (editingRole && roleDetail) {
      setName(roleDetail.name);
      setCode(roleDetail.code);
      setDescription(roleDetail.description ?? "");
      setDepartmentId(roleDetail.departmentId ?? "none");
      setManagerId(roleDetail.managerId ?? "none");
      setParentRoleId(roleDetail.parentRoleId ?? "none");
      setStatus(roleDetail.status);
      setHierarchyLevel(roleDetail.hierarchyLevel);
      setSelectedPermissionIds(
        roleDetail.permissions?.map((p) => p.permission.id) ?? []
      );
      setAutoCode(false);
    } else if (!editingRole) {
      setName("");
      setCode("");
      setDescription("");
      setDepartmentId("none");
      setManagerId("none");
      setParentRoleId("none");
      setStatus("ACTIVE");
      setHierarchyLevel(0);
      setSelectedPermissionIds([]);
      setAutoCode(true);
    }
  }, [open, editingRole, roleDetail]);

  useEffect(() => {
    if (autoCode && name && !editingRole) {
      setCode(generateRoleCode(name));
    }
  }, [name, autoCode, editingRole]);

  const saveMutation = useMutation({
    mutationFn: (payload: CustomRoleInput) =>
      editingRole
        ? apiFetch(`/api/roles/${editingRole.id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : apiFetch("/api/roles", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast.success(editingRole ? "Role updated" : "Role created");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CustomRoleInput = {
      name,
      code,
      description,
      departmentId: departmentId === "none" ? undefined : departmentId,
      managerId: managerId === "none" ? undefined : managerId,
      parentRoleId: parentRoleId === "none" ? undefined : parentRoleId,
      status,
      hierarchyLevel,
      permissionIds: selectedPermissionIds,
    };
    saveMutation.mutate(payload);
  };

  const readOnlySystem = !!editingRole?.isSystem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
          <DialogDescription>
            Define role details and select granular permissions by module.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="roleName">Role Name *</Label>
              <Input
                id="roleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={readOnlySystem}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleCode">Role Code</Label>
              <Input
                id="roleCode"
                value={code}
                onChange={(e) => {
                  setAutoCode(false);
                  setCode(e.target.value.toUpperCase());
                }}
                disabled={readOnlySystem}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="roleDescription">Description</Label>
            <Textarea
              id="roleDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reporting Manager</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.firstName} {m.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Parent Role (Hierarchy)</Label>
              <Select value={parentRoleId} onValueChange={setParentRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {roles
                    .filter((r) => r.id !== editingRole?.id)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hierarchyLevel">Hierarchy Level</Label>
              <Input
                id="hierarchyLevel"
                type="number"
                min={0}
                value={hierarchyLevel}
                onChange={(e) => setHierarchyLevel(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as "ACTIVE" | "INACTIVE")}
                disabled={readOnlySystem}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Permissions</Label>
            <PermissionMatrix
              permissions={permissions}
              selectedIds={selectedPermissionIds}
              onChange={setSelectedPermissionIds}
              disabled={readOnlySystem && editingRole?.name === "Super Admin"}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
