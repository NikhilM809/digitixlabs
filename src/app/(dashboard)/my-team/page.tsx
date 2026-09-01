"use client";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { UsersRound, ShieldAlert, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/client-api";
import { canViewTeam, canAccessWorkSchedules, isManagerRole } from "@/lib/permissions";
import type { UserStatus } from "@prisma/client";

interface TeamMember {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  role: string;
  status: UserStatus;
  email: string;
  department: { name: string } | null;
  designation: { name: string } | null;
}

interface TeamResponse {
  manager: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    role: string;
    designation: { name: string } | null;
    department: { name: string } | null;
  };
  directReports: TeamMember[];
  activeCount: number;
}

export default function MyTeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;

  const { data: access } = useQuery({
    queryKey: ["org-hierarchy-visibility"],
    queryFn: () => apiFetch<{ canView: boolean }>("/api/org-hierarchy/visibility"),
    enabled: status === "authenticated" && !!role,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["my-team"],
    queryFn: () => apiFetch<TeamResponse>("/api/org-hierarchy/team"),
    enabled:
      status === "authenticated" &&
      !!role &&
      canViewTeam(role) &&
      (role === "ADMIN" || role === "HR" || access?.canView === true),
  });

  if (status === "loading" || (role && role !== "ADMIN" && role !== "HR" && access === undefined)) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  if (!role || !canViewTeam(role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive/60 mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/leave")}>
          Go Back
        </Button>
      </div>
    );
  }

  if (role !== "ADMIN" && role !== "HR" && !access?.canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive/60 mb-4" />
        <h1 className="text-2xl font-bold">My Team Unavailable</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Your administrator has disabled organization hierarchy visibility for your role.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => router.push("/dashboard")}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UsersRound className="h-7 w-7 text-brand-600" />
          My Team
        </h1>
        <p className="text-muted-foreground mt-1">
          Direct reports assigned to you in the organization hierarchy
        </p>
      </div>

      <Card glass>
        <CardHeader>
          <CardTitle className="text-base">Direct Reports</CardTitle>
          <CardDescription>
            {data
              ? `${data.activeCount} active team member${data.activeCount === 1 ? "" : "s"}`
              : "Loading team..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !data?.directReports.length ? (
            <p className="py-10 text-center text-muted-foreground">
              No direct reports assigned to you yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="h-11 px-3 text-left font-medium text-muted-foreground">
                      Employee
                    </th>
                    <th className="h-11 px-3 text-left font-medium text-muted-foreground">
                      ID
                    </th>
                    <th className="h-11 px-3 text-left font-medium text-muted-foreground">
                      Designation
                    </th>
                    <th className="h-11 px-3 text-left font-medium text-muted-foreground">
                      Department
                    </th>
                    <th className="h-11 px-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    {role && isManagerRole(role) && canAccessWorkSchedules(role) && (
                      <th className="h-11 px-3 text-right font-medium text-muted-foreground">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.directReports.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b border-border/50 hover:bg-muted/20"
                    >
                      <td className="px-3 py-3 font-medium">
                        {member.firstName} {member.lastName}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {member.employeeId}
                      </td>
                      <td className="px-3 py-3">
                        {member.designation?.name ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        {member.department?.name ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant={
                            member.status === "ACTIVE" ? "outline" : "secondary"
                          }
                        >
                          {member.status}
                        </Badge>
                      </td>
                      {role && isManagerRole(role) && canAccessWorkSchedules(role) && (
                        <td className="px-3 py-3 text-right">
                          {member.status === "ACTIVE" && (
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/work-schedules?employeeId=${member.id}`}>
                                <Clock className="h-4 w-4" />
                                Work Schedule
                              </Link>
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
