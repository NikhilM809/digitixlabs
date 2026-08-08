"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { FileText, Plus, Trash2, Loader2, ShieldAlert } from "lucide-react";
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
import { canManagePolicies } from "@/lib/permissions";
import type { RoleName } from "@prisma/client";

interface CompanyPolicy {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
}

export default function PoliciesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = session?.user?.role as RoleName | undefined;
  const canManage = role ? canManagePolicies(role) : false;

  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: () => apiFetchArray<CompanyPolicy>("/api/policies"),
    enabled: status === "authenticated" && canManage,
  });

  const form = useForm<CompanyPolicyInput>({
    resolver: zodResolver(companyPolicySchema),
    defaultValues: { title: "", content: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: CompanyPolicyInput) =>
      apiFetch<CompanyPolicy>("/api/policies", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.success("Policy added");
      setDialogOpen(false);
      form.reset();
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

  if (status === "loading") {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive/60 mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Policy management is for Admin and HR only.</p>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/dashboard")}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-brand-600" />
            Company Policies
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage organization policies displayed to employees
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Policy
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : policies.length === 0 ? (
        <Card glass>
          <CardContent className="py-12 text-center text-muted-foreground">
            No policies yet. Click &quot;Add Policy&quot; to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => (
            <Card key={policy.id} glass>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-base">{policy.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => {
                      if (confirm(`Remove policy "${policy.title}"?`)) {
                        deleteMutation.mutate(policy.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{policy.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Policy</DialogTitle>
            <DialogDescription>Create a new company policy</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="title">Policy Title</Label>
              <Input id="title" {...form.register("title")} />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Policy Content</Label>
              <Textarea id="content" rows={5} {...form.register("content")} />
              {form.formState.errors.content && (
                <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Policy
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
