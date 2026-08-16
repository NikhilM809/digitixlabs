"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchApi } from "@/lib/api-client";
import {
  employeeDependentSchema,
  type EmployeeDependentInput,
} from "@/lib/validations";
import { formatDate } from "@/lib/utils";

interface Dependent {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: string | null;
  gender: string | null;
}

export function DependentDetailsPanel() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Dependent | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["dependents-settings"],
    queryFn: () => fetchApi<{ enabled: boolean }>("/api/profile/dependents-settings"),
  });

  const { data: dependents = [], isLoading } = useQuery({
    queryKey: ["profile-dependents"],
    queryFn: () => fetchApi<Dependent[]>("/api/profile/dependents"),
    enabled: settings?.enabled === true,
  });

  const form = useForm<EmployeeDependentInput>({
    resolver: zodResolver(employeeDependentSchema),
    defaultValues: {
      name: "",
      relationship: "",
      dateOfBirth: "",
      gender: "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: EmployeeDependentInput & { id?: string }) =>
      editing
        ? fetchApi("/api/profile/dependents", {
            method: "PUT",
            body: JSON.stringify({ id: editing.id, ...data }),
          })
        : fetchApi("/api/profile/dependents", {
            method: "POST",
            body: JSON.stringify(data),
          }),
    onSuccess: () => {
      toast.success(editing ? "Dependent updated" : "Dependent added");
      setEditing(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["profile-dependents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/profile/dependents?id=${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Dependent removed");
      queryClient.invalidateQueries({ queryKey: ["profile-dependents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (settings === undefined) {
    return (
      <Card glass>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading dependent details settings...
        </CardContent>
      </Card>
    );
  }

  if (!settings.enabled) {
    return (
      <Card glass>
        <CardHeader>
          <CardTitle>Dependent / Insurance Details</CardTitle>
          <CardDescription>
            This section is currently disabled by your administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            When enabled by Admin, you can enter dependent information here for
            insurance purposes.
          </p>
        </CardContent>
      </Card>
    );
  }

  function startEdit(dep: Dependent) {
    setEditing(dep);
    form.reset({
      name: dep.name,
      relationship: dep.relationship,
      dateOfBirth: dep.dateOfBirth
        ? new Date(dep.dateOfBirth).toISOString().slice(0, 10)
        : "",
      gender: dep.gender ?? "",
    });
  }

  return (
    <Card glass>
      <CardHeader>
        <CardTitle>Dependent / Insurance Details</CardTitle>
        <CardDescription>
          Add family dependent information required for insurance purposes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading dependents...</p>
        ) : dependents.length > 0 ? (
          <div className="space-y-3">
            {dependents.map((dep) => (
              <div
                key={dep.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/50 p-4"
              >
                <div>
                  <p className="font-medium">{dep.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {dep.relationship}
                    {dep.gender ? ` · ${dep.gender}` : ""}
                    {dep.dateOfBirth ? ` · DOB ${formatDate(dep.dateOfBirth)}` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(dep)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`Remove dependent ${dep.name}?`)) {
                        deleteMutation.mutate(dep.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No dependents added yet. Use the form below to add one.
          </p>
        )}

        <form
          onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
          className="space-y-4 rounded-xl border border-border/50 p-4"
        >
          <p className="text-sm font-medium">
            {editing ? "Edit Dependent" : "Add Dependent"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dep-name">Dependent Name</Label>
              <Input id="dep-name" {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dep-relationship">Relationship</Label>
              <Input id="dep-relationship" {...form.register("relationship")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dep-dob">Date of Birth</Label>
              <Input id="dep-dob" type="date" {...form.register("dateOfBirth")} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select
                value={form.watch("gender") ?? ""}
                onValueChange={(v) => form.setValue("gender", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            {editing && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  form.reset();
                }}
              >
                Cancel Edit
              </Button>
            )}
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {editing ? "Update Dependent" : "Add Dependent"}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
