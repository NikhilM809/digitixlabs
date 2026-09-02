"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { FileText, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { apiFetch, apiFetchArray } from "@/lib/client-api";
import { companyPolicySchema, type CompanyPolicyInput } from "@/lib/validations";
import { canManagePolicies, canViewPolicies } from "@/lib/permissions";
import type { RoleName } from "@prisma/client";

interface CompanyPolicy {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
}

type SavePolicyPayload = {
  data: CompanyPolicyInput;
  policyId?: string;
};

export default function PoliciesPage() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const role = session?.user?.role as RoleName | undefined;
  const canManage = role ? canManagePolicies(role) : false;
  const canView = role ? canViewPolicies(role) : false;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<CompanyPolicy | null>(null);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: () => apiFetchArray<CompanyPolicy>("/api/policies"),
    enabled: status === "authenticated" && canView,
  });

  const form = useForm<CompanyPolicyInput>({
    resolver: zodResolver(companyPolicySchema),
    defaultValues: { title: "", content: "" },
  });

  const openCreateDialog = () => {
    setEditingPolicy(null);
    form.reset({ title: "", content: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (policy: CompanyPolicy) => {
    setEditingPolicy(policy);
    form.reset({
      title: policy.title,
      content: policy.content,
      sortOrder: policy.sortOrder,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPolicy(null);
    form.reset({ title: "", content: "" });
  };

  const saveMutation = useMutation({
    mutationFn: ({ data, policyId }: SavePolicyPayload) => {
      if (policyId) {
        return apiFetch<CompanyPolicy>(`/api/policies/${policyId}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
      }
      return apiFetch<CompanyPolicy>("/api/policies", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.success(variables.policyId ? "Policy updated" : "Policy added");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/policies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.success("Policy removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = (data: CompanyPolicyInput) => {
    saveMutation.mutate({
      data,
      policyId: editingPolicy?.id,
    });
  };

  if (status === "loading") {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (!canView) {
    return (
      <Card glass>
        <CardContent className="py-12 text-center text-muted-foreground">
          You do not have access to company policies.
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-brand-600" />
            Company Policies
          </h1>
          <p className="text-muted-foreground mt-1">
            {canManage
              ? "Manage the Employee & Corporate Policy Handbook — add, edit, or remove sections"
              : "Employee & Corporate Policy Handbook and company guidelines"}
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : policies.length === 0 ? (
        <Card glass>
          <CardContent className="py-12 text-center text-muted-foreground">
            {canManage
              ? 'No policies yet. Click "Add Section" to create one.'
              : "No company policies have been published yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => (
            <Card key={policy.id} glass>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{policy.title}</CardTitle>
                {!canManage && (
                  <CardDescription className="mt-1">Company policy</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {policy.content}
                </p>
              </CardContent>
              {canManage && (
                <CardFooter className="flex justify-end gap-2 border-t border-border/50 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(policy)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Section
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Remove policy section "${policy.title}"?`)) {
                        deleteMutation.mutate(policy.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}

      {canManage && (
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPolicy ? "Edit Policy Section" : "Add Policy Section"}
              </DialogTitle>
              <DialogDescription>
                {editingPolicy
                  ? "Update the title or content of this handbook section"
                  : "Create a new section in the Employee & Corporate Policy Handbook"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Section Title</Label>
                <Input id="title" placeholder="e.g. 9. Travel Policy" {...form.register("title")} />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Section Content</Label>
                <Textarea
                  id="content"
                  rows={16}
                  placeholder="Enter policy text..."
                  className="font-mono text-sm"
                  {...form.register("content")}
                />
                {form.formState.errors.content && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.content.message}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingPolicy ? "Save Changes" : "Add Section"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  );
}
