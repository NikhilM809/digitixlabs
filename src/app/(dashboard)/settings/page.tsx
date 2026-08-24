"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Settings, Loader2, ShieldAlert, Clock, Building, Network, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch, apiFetchArray } from "@/lib/client-api";
import {
  companySettingsSchema,
  type CompanySettingsInput,
} from "@/lib/validations";

interface CompanySettings extends CompanySettingsInput {
  id: string;
}

interface ActiveEmployeeOption {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAdmin = session?.user?.role === "ADMIN";

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<CompanySettings>("/api/settings"),
    enabled: isAdmin,
  });

  const form = useForm<CompanySettingsInput>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      companyName: "Digitix Labs",
      companyEmail: "",
      companyTan: "",
      companyLogo: "",
      leavePolicy: "",
      attendanceRules: "",
      passwordPolicy: "",
      sessionTimeout: 30,
      workStartTime: "09:00",
      workEndTime: "18:00",
      lateThreshold: 15,
      orgHierarchyVisibleToEmployees: true,
      orgHierarchyVisibleToManagers: true,
      dependentDetailsEnabled: false,
      topLevelEmployeeId: null,
    },
  });

  const { data: activeEmployees = [] } = useQuery({
    queryKey: ["employees", "active", "settings-top-level"],
    queryFn: () =>
      apiFetchArray<ActiveEmployeeOption>("/api/employees?activeOnly=true"),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        companyName: settings.companyName,
        companyEmail: settings.companyEmail ?? "",
        companyTan: settings.companyTan ?? "",
        companyLogo: settings.companyLogo ?? "",
        leavePolicy: settings.leavePolicy ?? "",
        attendanceRules: settings.attendanceRules ?? "",
        passwordPolicy: settings.passwordPolicy ?? "",
        sessionTimeout: settings.sessionTimeout,
        workStartTime: settings.workStartTime,
        workEndTime: settings.workEndTime,
        lateThreshold: settings.lateThreshold,
        orgHierarchyVisibleToEmployees:
          settings.orgHierarchyVisibleToEmployees ?? true,
        orgHierarchyVisibleToManagers:
          settings.orgHierarchyVisibleToManagers ?? true,
        dependentDetailsEnabled: settings.dependentDetailsEnabled ?? false,
        topLevelEmployeeId: settings.topLevelEmployeeId ?? null,
      });
    }
  }, [settings, form]);

  const saveMutation = useMutation({
    mutationFn: (data: CompanySettingsInput) =>
      apiFetch<CompanySettings>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["org-hierarchy-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["org-hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["org-chart"] });
      queryClient.invalidateQueries({ queryKey: ["dependents-settings"] });
      toast.success("Settings saved successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[50vh] text-center"
      >
        <ShieldAlert className="h-16 w-16 text-destructive/60 mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Company settings are only accessible to administrators.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/dashboard")}>
          Go to Dashboard
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-7 w-7 text-brand-600" />
          Company Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure organization-wide policies and preferences
        </p>
      </div>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Employee Roles
          </CardTitle>
          <CardDescription>
            Create roles like CEO, CTO, Delivery Manager, or Project Manager and assign them
            when adding employees.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/settings/roles">Manage Employee Roles</Link>
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      ) : isError ? (
        <Card glass>
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">Failed to load settings</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please refresh the page or try again later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <form
          onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
          className="space-y-6"
        >
          <Card glass>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4" />
                Organization Hierarchy Visibility
              </CardTitle>
              <CardDescription>
                Show or hide Organization Structure and My Team for employees and managers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
                <div>
                  <Label htmlFor="org-visible-employees" className="font-medium">
                    Show to Employees
                  </Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    When off, employees cannot see Organization Structure in the menu
                  </p>
                </div>
                <Switch
                  id="org-visible-employees"
                  checked={form.watch("orgHierarchyVisibleToEmployees") ?? true}
                  onCheckedChange={(checked) =>
                    form.setValue("orgHierarchyVisibleToEmployees", checked, {
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
                <div>
                  <Label htmlFor="org-visible-managers" className="font-medium">
                    Show to Managers
                  </Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    When off, managers cannot see Organization Structure or My Team
                  </p>
                </div>
                <Switch
                  id="org-visible-managers"
                  checked={form.watch("orgHierarchyVisibleToManagers") ?? true}
                  onCheckedChange={(checked) =>
                    form.setValue("orgHierarchyVisibleToManagers", checked, {
                      shouldDirty: true,
                    })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Admin and HR always have access.
              </p>
              <div className="space-y-2 pt-2 border-t border-border/40">
                <Label htmlFor="top-level-employee">Top-Level Employee</Label>
                <Select
                  value={form.watch("topLevelEmployeeId") ?? "none"}
                  onValueChange={(value) =>
                    form.setValue(
                      "topLevelEmployeeId",
                      value === "none" ? null : value,
                      { shouldDirty: true }
                    )
                  }
                >
                  <SelectTrigger id="top-level-employee">
                    <SelectValue placeholder="Select top-level employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set (multiple roots allowed)</SelectItem>
                    {activeEmployees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName} ({employee.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Organization View always starts from this employee and shows only their
                  reporting subtree.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card glass>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4" />
                Company Information
              </CardTitle>
              <CardDescription>Basic company profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" {...form.register("companyName")} />
                {form.formState.errors.companyName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.companyName.message}
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Company Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    {...form.register("companyEmail")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyTan">Company TAN</Label>
                  <Input
                    id="companyTan"
                    placeholder="e.g. DELD12345A"
                    {...form.register("companyTan")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyLogo">Logo URL</Label>
                  <Input
                    id="companyLogo"
                    placeholder="https://..."
                    {...form.register("companyLogo")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card glass>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Work Schedule
              </CardTitle>
              <CardDescription>
                Default working hours and attendance rules
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="workStartTime">Work Start</Label>
                  <Input
                    id="workStartTime"
                    type="time"
                    {...form.register("workStartTime")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workEndTime">Work End</Label>
                  <Input
                    id="workEndTime"
                    type="time"
                    {...form.register("workEndTime")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lateThreshold">Late Threshold (min)</Label>
                  <Input
                    id="lateThreshold"
                    type="number"
                    min={0}
                    max={120}
                    {...form.register("lateThreshold", { valueAsNumber: true })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                <Input
                  id="sessionTimeout"
                  type="number"
                  min={5}
                  max={480}
                  className="max-w-xs"
                  {...form.register("sessionTimeout", { valueAsNumber: true })}
                />
              </div>
            </CardContent>
          </Card>

          <Card glass>
            <CardHeader>
              <CardTitle className="text-base">Policies</CardTitle>
              <CardDescription>
                Organization policies displayed to employees
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="leavePolicy">Leave Policy</Label>
                <Textarea
                  id="leavePolicy"
                  rows={4}
                  placeholder="Describe your leave policy..."
                  {...form.register("leavePolicy")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendanceRules">Attendance Rules</Label>
                <Textarea
                  id="attendanceRules"
                  rows={4}
                  placeholder="Describe attendance expectations..."
                  {...form.register("attendanceRules")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordPolicy">Password Policy</Label>
                <Textarea
                  id="passwordPolicy"
                  rows={3}
                  placeholder="Password requirements for employees..."
                  {...form.register("passwordPolicy")}
                />
              </div>
            </CardContent>
          </Card>

          <Card glass>
            <CardHeader>
              <CardTitle className="text-base">Employee Profile Features</CardTitle>
              <CardDescription>
                Control optional sections shown on employee profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
                <div>
                  <Label htmlFor="dependent-details-enabled" className="font-medium">
                    Dependent Details
                  </Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    When enabled, employees can enter dependent information for insurance
                  </p>
                </div>
                <Switch
                  id="dependent-details-enabled"
                  checked={form.watch("dependentDetailsEnabled") ?? false}
                  onCheckedChange={(checked) =>
                    form.setValue("dependentDetailsEnabled", checked, {
                      shouldDirty: true,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={saveMutation.isPending}>
              {saveMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save Settings
            </Button>
          </div>
        </form>
      )}
    </motion.div>
  );
}
