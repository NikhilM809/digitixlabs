"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  FileText,
  Upload,
  Download,
  Search,
  Loader2,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/client-api";
import { payslipSchema } from "@/lib/validations";

interface Payslip {
  id: string;
  userId: string;
  month: number;
  year: number;
  salary: number;
  bonus: number;
  deductions: number;
  netSalary: number;
  fileUrl: string | null;
  createdAt: string;
  user: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    department: { name: string } | null;
  };
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
}

type PayslipFormValues = {
  userId: string;
  month: number;
  year: number;
  salary: number;
  bonus: number;
  deductions: number;
  fileUrl?: string;
};

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function downloadPayslipPdf(payslip: Payslip) {
  const doc = new jsPDF();
  const monthName = MONTHS.find((m) => m.value === payslip.month)?.label ?? "";

  doc.setFontSize(18);
  doc.text("Digitix HRMS - Payslip", 14, 20);
  doc.setFontSize(11);
  doc.text(`${monthName} ${payslip.year}`, 14, 30);

  autoTable(doc, {
    startY: 38,
    head: [["Field", "Value"]],
    body: [
      ["Employee ID", payslip.user.employeeId],
      ["Name", `${payslip.user.firstName} ${payslip.user.lastName}`],
      ["Department", payslip.user.department?.name ?? "-"],
      ["Basic Salary", formatCurrency(payslip.salary)],
      ["Bonus", formatCurrency(payslip.bonus)],
      ["Deductions", formatCurrency(payslip.deductions)],
      ["Net Salary", formatCurrency(payslip.netSalary)],
    ],
    headStyles: { fillColor: [6, 147, 227] },
  });

  doc.save(`payslip-${payslip.user.employeeId}-${payslip.month}-${payslip.year}.pdf`);
}

export default function PayslipsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const queryClient = useQueryClient();

  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  const queryParams = new URLSearchParams();
  if (monthFilter !== "all") queryParams.set("month", monthFilter);
  if (yearFilter !== "all") queryParams.set("year", yearFilter);
  const queryString = queryParams.toString();

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ["payslips", monthFilter, yearFilter],
    queryFn: () =>
      apiFetch<Payslip[]>(`/api/payslips${queryString ? `?${queryString}` : ""}`),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: () => apiFetch<Employee[]>("/api/employees"),
    enabled: isAdmin,
  });

  const form = useForm<PayslipFormValues>({
    resolver: zodResolver(payslipSchema) as Resolver<PayslipFormValues>,
    defaultValues: {
      userId: "",
      month: new Date().getMonth() + 1,
      year: currentYear,
      salary: 0,
      bonus: 0,
      deductions: 0,
      fileUrl: "",
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (data: PayslipFormValues) =>
      apiFetch<Payslip>("/api/payslips", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
      toast.success("Payslip uploaded successfully");
      setUploadOpen(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredPayslips = payslips.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const name = `${p.user.firstName} ${p.user.lastName}`.toLowerCase();
    return (
      name.includes(term) ||
      p.user.employeeId.toLowerCase().includes(term) ||
      p.user.email.toLowerCase().includes(term)
    );
  });

  const handleDownload = (payslip: Payslip) => {
    if (payslip.fileUrl) {
      window.open(payslip.fileUrl, "_blank");
      return;
    }
    downloadPayslipPdf(payslip);
    toast.success("Payslip downloaded");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-brand-600" />
            Payslips
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? "Upload and manage employee payslips"
              : "View and download your payslips"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload Payslip
          </Button>
        )}
      </div>

      <Card glass>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Search & Filters</CardTitle>
          <CardDescription>Filter payslips by month and year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative sm:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employee..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card glass>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Employee
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Period
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Salary
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Net Pay
                  </th>
                  <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                    Uploaded
                  </th>
                  <th className="h-12 px-4 text-right font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredPayslips.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No payslips found for the selected period
                    </td>
                  </tr>
                ) : (
                  filteredPayslips.map((payslip) => (
                    <tr
                      key={payslip.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">
                            {payslip.user.firstName} {payslip.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payslip.user.employeeId}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {MONTHS.find((m) => m.value === payslip.month)?.label}{" "}
                          {payslip.year}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {formatCurrency(payslip.salary)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(payslip.netSalary)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {format(new Date(payslip.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(payslip)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-brand-600" />
              Upload Payslip
            </DialogTitle>
            <DialogDescription>
              Create or update a payslip for an employee
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((data) => uploadMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={form.watch("userId")}
                onValueChange={(v) => form.setValue("userId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.userId && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.userId.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select
                  value={String(form.watch("month"))}
                  onValueChange={(v) => form.setValue("month", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select
                  value={String(form.watch("year"))}
                  onValueChange={(v) => form.setValue("year", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="salary">Salary</Label>
                <Input
                  id="salary"
                  type="number"
                  min={0}
                  {...form.register("salary", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonus">Bonus</Label>
                <Input
                  id="bonus"
                  type="number"
                  min={0}
                  {...form.register("bonus", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deductions">Deductions</Label>
                <Input
                  id="deductions"
                  type="number"
                  min={0}
                  {...form.register("deductions", { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileUrl">File URL (optional)</Label>
              <Input
                id="fileUrl"
                placeholder="https://..."
                {...form.register("fileUrl")}
              />
            </div>

            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Net Salary: </span>
              <span className="font-semibold">
                {formatCurrency(
                  (form.watch("salary") || 0) +
                    (form.watch("bonus") || 0) -
                    (form.watch("deductions") || 0)
                )}
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUploadOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={uploadMutation.isPending}>
                {uploadMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Upload
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
