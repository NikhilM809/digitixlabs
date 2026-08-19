"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  RoleFormDialog,
  type RoleRecord,
} from "@/components/roles/role-form-dialog";
import { apiFetch, apiFetchArray } from "@/lib/client-api";

interface RoleRow extends RoleRecord {
  _count: { userRoles: number; permissions: number };
}

export default function RolesSettingsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const isAdmin = session?.user?.role === "ADMIN";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);

  const queryKey = ["roles", search, statusFilter];

  const { data: roles = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const q = params.toString();
      return apiFetchArray<RoleRow>(`/api/roles${q ? `?${q}` : ""}`);
    },
    enabled: isAdmin,
  });

  const sortedRoles = useMemo(
    () => [...roles].sort((a, b) => b.hierarchyLevel - a.hierarchyLevel || a.name.localeCompare(b.name)),
    [roles]
  );

  const duplicateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/roles/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Role duplicated");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["roles-assignable"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "activate" | "deactivate" }) =>
      apiFetch(`/api/roles/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!isAdmin) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        You do not have access to role management.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Roles & Permissions
            </h1>
            <p className="text-muted-foreground mt-1">
              Create custom roles, assign permissions, and manage access control.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingRole(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Role
          </Button>
        </div>
      </motion.div>

      <Card glass>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
          <CardDescription>
            System roles are protected. Custom roles can be edited, duplicated, or deleted when
            unassigned.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search roles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Employees</th>
                    <th className="px-4 py-3 font-medium">Permissions</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRoles.map((role) => (
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
                      <td className="px-4 py-3">{role.department?.name ?? "—"}</td>
                      <td className="px-4 py-3">{role._count.userRoles}</td>
                      <td className="px-4 py-3">{role._count.permissions}</td>
                      <td className="px-4 py-3">
                        <Badge variant={role.status === "ACTIVE" ? "success" : "secondary"}>
                          {role.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Edit"
                            onClick={() => {
                              setEditingRole(role);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Duplicate"
                            onClick={() => duplicateMutation.mutate(role.id)}
                            disabled={duplicateMutation.isPending}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {!role.isSystem && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                title={role.status === "ACTIVE" ? "Deactivate" : "Activate"}
                                onClick={() =>
                                  statusMutation.mutate({
                                    id: role.id,
                                    action: role.status === "ACTIVE" ? "deactivate" : "activate",
                                  })
                                }
                              >
                                {role.status === "ACTIVE" ? (
                                  <PowerOff className="h-4 w-4" />
                                ) : (
                                  <Power className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Delete"
                                disabled={role._count.userRoles > 0 || deleteMutation.isPending}
                                onClick={() => {
                                  if (confirm(`Delete role "${role.name}"?`)) {
                                    deleteMutation.mutate(role.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sortedRoles.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        No roles found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RoleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingRole={editingRole}
      />
    </div>
  );
}
