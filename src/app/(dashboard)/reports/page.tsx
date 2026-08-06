"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Download,
  Calendar,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/client-api";
import {
  exportToCsv,
  exportToExcel,
  exportToPdf,
  type ExportRow,
} from "@/lib/export-utils";

type ReportType = "attendance" | "leave" | "employee" | "department";

const REPORT_TITLES: Record<ReportType, string> = {
  attendance: "Attendance Report",
  leave: "Leave Report",
  employee: "Employee Report",
  department: "Department Report",
};

function ExportButtons({
  rows,
  reportType,
}: {
  rows: ExportRow[];
  reportType: ReportType;
}) {
  const filename = `${reportType}-report-${format(new Date(), "yyyy-MM-dd")}`;
  const title = REPORT_TITLES[reportType];

  const handleExport = (type: "excel" | "csv" | "pdf") => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    if (type === "excel") exportToExcel(rows, filename);
    if (type === "csv") exportToCsv(rows, filename);
    if (type === "pdf") exportToPdf(rows, filename, title);
    toast.success(`Exported as ${type.toUpperCase()}`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>
        <FileSpreadsheet className="h-4 w-4" />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
        <Download className="h-4 w-4" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
        <FileText className="h-4 w-4" />
        PDF
      </Button>
    </div>
  );
}

function ReportTable({
  rows,
  isLoading,
}: {
  rows: ExportRow[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4 opacity-40" />
        <p>No data available for this report</p>
      </div>
    );
  }

  const headers = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            {headers.map((header) => (
              <th
                key={header}
                className="h-11 px-4 text-left font-medium text-muted-foreground capitalize whitespace-nowrap"
              >
                {header.replace(/([A-Z])/g, " $1").trim()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border/50 hover:bg-muted/30 transition-colors"
            >
              {headers.map((header) => (
                <td key={header} className="px-4 py-2.5 whitespace-nowrap">
                  {String(row[header] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportPanel({ type, from, to }: { type: ReportType; from: string; to: string }) {
  const params = new URLSearchParams({ type });
  if (from && to) {
    params.set("from", from);
    params.set("to", to);
  }

  const { data: rows = [], isLoading, isFetching } = useQuery({
    queryKey: ["reports", type, from, to],
    queryFn: () => apiFetch<ExportRow[]>(`/api/reports?${params.toString()}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{rows.length} records</Badge>
          {isFetching && !isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <ExportButtons rows={rows} reportType={type} />
      </div>
      <ReportTable rows={rows} isLoading={isLoading} />
    </div>
  );
}

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [activeTab, setActiveTab] = useState<ReportType>("attendance");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-brand-600" />
          Reports
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate and export HR analytics reports
        </p>
      </div>

      <Card glass>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date Range
          </CardTitle>
          <CardDescription>
            Applies to Attendance and Leave reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="fromDate">From</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toDate">To</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card glass>
        <CardContent className="p-4 sm:p-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ReportType)}
          >
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="leave">Leave</TabsTrigger>
              <TabsTrigger value="employee">Employee</TabsTrigger>
              <TabsTrigger value="department">Department</TabsTrigger>
            </TabsList>

            <TabsContent value="attendance">
              <ReportPanel type="attendance" from={fromDate} to={toDate} />
            </TabsContent>
            <TabsContent value="leave">
              <ReportPanel type="leave" from={fromDate} to={toDate} />
            </TabsContent>
            <TabsContent value="employee">
              <ReportPanel type="employee" from={fromDate} to={toDate} />
            </TabsContent>
            <TabsContent value="department">
              <ReportPanel type="department" from={fromDate} to={toDate} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
