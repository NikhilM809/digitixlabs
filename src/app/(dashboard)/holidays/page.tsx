"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { PartyPopper, MapPin, Calendar, ChevronLeft, ChevronRight, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/dashboard/activity-feed";
import { fetchApi } from "@/lib/api-client";
import { holidaySchema, type HolidayInput } from "@/lib/validations";
import { formatDate, cn } from "@/lib/utils";
import { canManageHolidays } from "@/lib/permissions";
import type { RoleName } from "@prisma/client";

interface Holiday {
  id: string;
  name: string;
  date: string;
  description: string | null;
  isRegional: boolean;
  region: string | null;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function HolidaysPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as RoleName | undefined;
  const canManage = role ? canManageHolidays(role) : false;
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<HolidayInput>({
    resolver: zodResolver(holidaySchema) as Resolver<HolidayInput>,
    defaultValues: { isRegional: false },
  });

  const { data: holidays, isLoading } = useQuery({
    queryKey: ["holidays", year],
    queryFn: () => fetchApi<Holiday[]>(`/api/holidays?year=${year}`),
  });

  const createMutation = useMutation({
    mutationFn: (data: HolidayInput) =>
      fetchApi("/api/holidays", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Holiday added");
      setDialogOpen(false);
      form.reset({ isRegional: false });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi(`/api/holidays/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Holiday removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = holidays?.filter((h) => new Date(h.date) >= today) ?? [];
  const past = holidays?.filter((h) => new Date(h.date) < today) ?? [];

  const holidaysByMonth = holidays?.reduce<Record<number, Holiday[]>>((acc, h) => {
    const month = new Date(h.date).getMonth();
    if (!acc[month]) acc[month] = [];
    acc[month].push(h);
    return acc;
  }, {}) ?? {};

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Holiday Calendar</h1>
          <p className="text-muted-foreground mt-1">
            Company holidays and observances for {year}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Holiday
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setYear((y) => y - 1)}
            disabled={year <= currentYear - 2}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[4rem] text-center">{year}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= currentYear + 2}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card glass>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-brand-600">{holidays?.length ?? 0}</p>
            <p className="text-sm text-muted-foreground mt-1">Total Holidays</p>
          </CardContent>
        </Card>
        <Card glass>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-emerald-600">{upcoming.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Upcoming</p>
          </CardContent>
        </Card>
        <Card glass>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-muted-foreground">{past.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Past</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : holidays && holidays.length > 0 ? (
        <div className="space-y-8">
          {monthNames.map((monthName, monthIndex) => {
            const monthHolidays = holidaysByMonth[monthIndex];
            if (!monthHolidays?.length) return null;

            return (
              <div key={monthName}>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-brand-600" />
                  {monthName} {year}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {monthHolidays.map((holiday) => {
                    const holidayDate = new Date(holiday.date);
                    const isPast = holidayDate < today;
                    const isToday =
                      holidayDate.toDateString() === today.toDateString();

                    return (
                      <Card
                        key={holiday.id}
                        glass
                        className={cn(
                          "transition-all hover:shadow-lg",
                          isToday && "ring-2 ring-brand-500/50",
                          isPast && "opacity-60"
                        )}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="rounded-xl bg-brand-500/10 p-2">
                              <PartyPopper className="h-5 w-5 text-brand-600" />
                            </div>
                            <div className="flex gap-1 items-start">
                              {isToday && <Badge variant="success">Today</Badge>}
                              {holiday.isRegional && (
                                <Badge variant="info">Regional</Badge>
                              )}
                              {canManage && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm(`Remove holiday "${holiday.name}"?`)) {
                                      deleteMutation.mutate(holiday.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <CardTitle className="text-base mt-2">{holiday.name}</CardTitle>
                          <CardDescription>{formatDate(holiday.date, { weekday: "long" })}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {holiday.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {holiday.description}
                            </p>
                          )}
                          {holiday.isRegional && holiday.region && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {holiday.region}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card glass>
          <CardContent>
            <EmptyState
              icon={PartyPopper}
              title="No holidays scheduled"
              description={`No holidays have been configured for ${year}.`}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
            <DialogDescription>Add a new company holiday</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Holiday Name</Label>
              <Input id="name" {...form.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...form.register("date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea id="description" {...form.register("description")} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Holiday
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
