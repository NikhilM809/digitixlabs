"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
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
import { apiFetch, apiFetchArray } from "@/lib/client-api";
import type { RoleName } from "@prisma/client";

interface EmployeeRoleRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  accessLevel: RoleName;
  isSystem: boolean;
  isActive: boolean;
  _count: { employees: number };
}

const ACCESS_LABELS: Record<RoleName, string> = {
  ADMIN: "Admin access (full)",
  HR: "HR access",
  MANAGER: "Manager access",
  EMPLOYEE: "Employee access",
};

export default function EmployeeRolesSettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRoleRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accessLevel, setAccessLevel] = useState<RoleName>("EMPLOYEE");

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["employee-roles"],
    queryFn: () => apiFetchArray<EmployeeRoleRow>("/api/employee-roles"),
    enabled: isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? apiFetch(`/api/employee-roles/${editing.id}`, {
            method: "PUT",
            body: JSON.stringify({ name, description, accessLevel }),
          })
        : apiFetch("/api/employee-roles", {
            method: "POST",
            body: JSON.stringify({ name, description, accessLevel }),
          }),
    onSuccess: () => {
      toast.success(editing ? "Role updated" : "Role created");
      queryClient.invalidateQueries({ queryKey: ["employee-roles"] });
      setDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/employee-roles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["employee-roles"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setAccessLevel("EMPLOYEE");
    setDialogOpen(true);
  };

  const openEdit = (role: EmployeeRoleRow) => {
    setEditing(role);
    setName(role.name);
    setDescription(role.description ?? "");
    setAccessLevel(role.accessLevel);
    setDialogOpen(true);
  };

  if (!isAdmin) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Only administrators can manage employee roles.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Employee Roles</h1>
            <p className="text-muted-foreground mt-1">
              Create roles like CEO, CTO, Delivery Manager, PM — assign them when adding or
              editing employees.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </Button>
        </div>
      </div>

      <Card glass>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
          <CardDescription>
            System roles (Admin, HR, Manager, Employee) are protected. Custom roles can be
            edited or deleted when not in use.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Access Level</th>
                    <th className="px-4 py-3">Employees</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} className="border-t border-border/40">
                      <td className="px-4 py-3">
                        <div className="font-medium">{role.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{role.code}</div>
                        {role.isSystem && (
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            System
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">{ACCESS_LABELS[role.accessLevel]}</td>
                      <td className="px-4 py-3">{role._count.employees}</td>
                      <td className="px-4 py-3">
                        <Badge variant={role.isActive ? "success" : "secondary"}>
                          {role.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(role)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!role.isSystem && (
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={role._count.employees > 0}
                            onClick={() => {
                              if (confirm(`Delete role "${role.name}"?`)) {
                                deleteMutation.mutate(role.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Role" : "Create Role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Delivery Manager"
                disabled={editing?.isSystem}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>System Access Level</Label>
              <Select
                value={accessLevel}
                onValueChange={(v) => setAccessLevel(v as RoleName)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin access</SelectItem>
                  <SelectItem value="HR">HR access</SelectItem>
                  <SelectItem value="MANAGER">Manager access</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee access</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls what the employee can do in the system. The role title (CEO, PM, etc.)
                is separate from this access level.
              </p>
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
