"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { PartyPopper, MapPin, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/activity-feed";
import { fetchApi } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";

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
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data: holidays, isLoading } = useQuery({
    queryKey: ["holidays", year],
    queryFn: () => fetchApi<Holiday[]>(`/api/holidays?year=${year}`),
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card glass>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-brand-600">{holidays?.length ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Holidays</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card glass>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-emerald-600">{upcoming.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Upcoming</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card glass>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-muted-foreground">{past.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Past</p>
            </CardContent>
          </Card>
        </motion.div>
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
              <motion.div
                key={monthName}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
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
                            <div className="flex gap-1">
                              {isToday && <Badge variant="success">Today</Badge>}
                              {holiday.isRegional && (
                                <Badge variant="info">Regional</Badge>
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
              </motion.div>
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
    </div>
  );
}
