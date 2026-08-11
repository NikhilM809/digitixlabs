"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Network, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OrgChart, type OrgChartNodeData } from "@/components/org/org-chart";
import { apiFetch } from "@/lib/client-api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface ChartResponse {
  tree: OrgChartNodeData[];
  currentUserId: string;
  expandPath: string[];
  self: {
    id: string;
    firstName: string;
    lastName: string;
    managerName: string | null;
    designation: { name: string } | null;
    department: { name: string } | null;
  } | null;
  directReports: Array<{
    id: string;
    firstName: string;
    lastName: string;
    designation: { name: string } | null;
  }>;
}

export default function OrganizationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: access } = useQuery({
    queryKey: ["org-hierarchy-visibility"],
    queryFn: () =>
      apiFetch<{ canView: boolean }>("/api/org-hierarchy/visibility"),
    enabled: status === "authenticated",
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["org-chart", debouncedSearch],
    queryFn: () =>
      apiFetch<ChartResponse>(
        `/api/org-hierarchy/chart${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ""}`
      ),
    enabled: status === "authenticated" && access?.canView === true,
  });

  if (status === "loading" || access === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!access?.canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive/60 mb-4" />
        <h1 className="text-2xl font-bold">Organization Structure Unavailable</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Your administrator has disabled organization hierarchy visibility for your role.
        </p>
        <Button
          className="mt-6"
          variant="outline"
          onClick={() =>
            router.push(session?.user?.role === "EMPLOYEE" ? "/leave" : "/dashboard")
          }
        >
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
          <Network className="h-7 w-7 text-brand-600" />
          Organization Structure
        </h1>
        <p className="text-muted-foreground mt-1">
          Complete reporting hierarchy from top management to employees
        </p>
      </div>

      {data?.self && (
        <Card glass>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your Position</CardTitle>
            <CardDescription>
              {data.self.designation?.name ?? session?.user?.role}
              {data.self.department?.name ? ` · ${data.self.department.name}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Reporting Manager</p>
              <p className="font-medium">
                {data.self.managerName ?? "None (top level)"}
              </p>
            </div>
            {data.directReports.length > 0 && (
              <div>
                <p className="text-muted-foreground">Direct Reports</p>
                <p className="font-medium">
                  {data.directReports
                    .map((r) => `${r.firstName} ${r.lastName}`)
                    .join(", ")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card glass>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Organization Chart</CardTitle>
          <CardDescription>
            Expand or collapse levels to explore reporting relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <p className="py-12 text-center text-destructive">
              Failed to load organization structure.
            </p>
          ) : data ? (
            <OrgChart
              tree={data.tree}
              currentUserId={data.currentUserId}
              expandPath={data.expandPath}
              searchQuery={search}
              onSearch={setSearch}
            />
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}
