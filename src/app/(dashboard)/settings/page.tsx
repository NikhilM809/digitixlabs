"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Settings, Loader2, ShieldAlert, Clock, Building } from "lucide-react";
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
import { apiFetch } from "@/lib/client-api";
import {
  companySettingsSchema,
  type CompanySettingsInput,
} from "@/lib/validations";

interface CompanySettings extends CompanySettingsInput {
  id: string;
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
      companyLogo: "",
      leavePolicy: "",
      attendanceRules: "",
      passwordPolicy: "",
      sessionTimeout: 30,
      workStartTime: "09:00",
      workEndTime: "18:00",
      lateThreshold: 15,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        companyName: settings.companyName,
        companyEmail: settings.companyEmail ?? "",
        companyLogo: settings.companyLogo ?? "",
        leavePolicy: settings.leavePolicy ?? "",
        attendanceRules: settings.attendanceRules ?? "",
        passwordPolicy: settings.passwordPolicy ?? "",
        sessionTimeout: settings.sessionTimeout,
        workStartTime: settings.workStartTime,
        workEndTime: settings.workEndTime,
        lateThreshold: settings.lateThreshold,
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
