"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  createColumnHelper,
  createCoreRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  Plus,
  Search,
  Pencil,
  UserX,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { EmploymentType, RoleName, UserStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canManageEmployees, isAdminOrHr } from "@/lib/permissions";
import { apiFetch, apiFetchArray } from "@/lib/client-api";
import { employeeSchema, type EmployeeInput } from "@/lib/validations";
import { cn } from "@/lib/utils";
import { ProfileAvatarUpload } from "@/components/profile/profile-avatar-upload";

const EMPTY_EMPLOYEES: Employee[] = [];

const tableFeatureSet = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  coreRowModel: createCoreRowModel(),
});

interface Employee {
  id: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar?: string | null;
  role: RoleName;
  orgRoleId: string | null;
  orgRole?: { id: string; name: string; code: string; accessLevel: RoleName } | null;
  employmentType: EmploymentType;
  status: UserStatus;
  joiningDate: string;
  dateOfBirth: string | null;
  emergencyContact: string | null;
  pan?: string | null;
  aadhaarNumber?: string | null;
  bankAccountNumber?: string | null;
  departmentId: string | null;
  designationId: string | null;
  managerId: string | null;
  department: { id: string; name: string } | null;
  designation: { id: string; name: string } | null;
  manager: { id: string; firstName: string; lastName: string } | null;
  baseSalary?: number;
  ctc?: number;
  incentive?: number;
  reimbursement?: number;
}

interface EmployeeDependent {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: string | null;
  gender: string | null;
}

const statusColors: Record<UserStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  LEFT: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  TERMINATED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

interface Department {
  id: string;
  name: string;
}

interface Designation {
  id: string;
  name: string;
}

interface EmployeeRoleOption {
  id: string;
  name: string;
  code: string;
  accessLevel: RoleName;
  isSystem: boolean;
  isActive: boolean;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildEmployeeQuery(params: Record<string, string>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") search.set(key, value);
  });
  const query = search.toString();
  return `/api/employees${query ? `?${query}` : ""}`;
}

export default function EmployeesPage() {
  const { data: session, status } = useSession();
  const canCreateEmployee = session?.user?.role
    ? isAdminOrHr(session.user.role)
    : false;
  const canEditSalary = canCreateEmployee;
  const canManage = session?.user?.role
    ? canManageEmployees(session.user.role)
    : false;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employmentFilter, setEmploymentFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const queryParams = {
    search,
    departmentId: departmentFilter,
    orgRoleId: roleFilter,
    status: statusFilter,
    employmentType: employmentFilter,
  };

  const { data: employees = EMPTY_EMPLOYEES, isLoading } = useQuery({
    queryKey: ["employees", queryParams],
    queryFn: () => apiFetchArray<Employee>(buildEmployeeQuery(queryParams)),
    enabled: status === "authenticated" && canManage,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => apiFetchArray<Department>("/api/departments"),
    enabled: status === "authenticated" && canManage,
  });

  const { data: designations = [] } = useQuery({
    queryKey: ["designations"],
    queryFn: () => apiFetchArray<Designation>("/api/designations?activeOnly=true"),
    enabled: status === "authenticated" && canManage,
  });

  const { data: employeeRoles = [] } = useQuery({
    queryKey: ["employee-roles", "active"],
    queryFn: () =>
      apiFetchArray<EmployeeRoleOption>("/api/employee-roles?activeOnly=true"),
    enabled: status === "authenticated" && canManage,
  });

  const defaultEmployeeRoleId =
    employeeRoles.find((r) => r.code === "EMPLOYEE")?.id ?? employeeRoles[0]?.id ?? "";

  const form = useForm<EmployeeInput>({
    resolver: zodResolver(employeeSchema) as Resolver<EmployeeInput>,
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      orgRoleId: "",
      employmentType: "FULL_TIME",
      joiningDate: format(new Date(), "yyyy-MM-dd"),
      pan: "",
      aadhaarNumber: "",
      bankAccountNumber: "",
      baseSalary: 0,
      ctc: 0,
      incentive: 0,
      reimbursement: 0,
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: EmployeeInput) =>
      editingEmployee
        ? apiFetch<Employee>(`/api/employees/${editingEmployee.id}`, {
            method: "PUT",
            body: JSON.stringify(data),
          })
        : apiFetch<Employee>("/api/employees", {
            method: "POST",
            body: JSON.stringify(data),
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(editingEmployee ? "Employee updated" : "Employee created");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: editingDependents } = useQuery({
    queryKey: ["employee-dependents", editingEmployee?.id],
    queryFn: () =>
      apiFetch<{ enabled: boolean; dependents: EmployeeDependent[] }>(
        `/api/employees/${editingEmployee!.id}/dependents`
      ),
    enabled: !!editingEmployee && canCreateEmployee,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee marked as left");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingEmployee(null);
    form.reset({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      orgRoleId: defaultEmployeeRoleId,
      employmentType: "FULL_TIME",
      joiningDate: format(new Date(), "yyyy-MM-dd"),
      departmentId: undefined,
      designationId: undefined,
      managerId: undefined,
      pan: "",
      aadhaarNumber: "",
      bankAccountNumber: "",
      baseSalary: 0,
      incentive: 0,
      reimbursement: 0,
    });
    setDialogOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    form.reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      phone: employee.phone ?? "",
      orgRoleId: employee.orgRoleId ?? defaultEmployeeRoleId,
      employmentType: employee.employmentType,
      departmentId: employee.departmentId ?? undefined,
      designationId: employee.designationId ?? undefined,
      managerId: employee.managerId ?? undefined,
      joiningDate: format(new Date(employee.joiningDate), "yyyy-MM-dd"),
      dateOfBirth: employee.dateOfBirth
        ? format(new Date(employee.dateOfBirth), "yyyy-MM-dd")
        : undefined,
      emergencyContact: employee.emergencyContact ?? "",
      pan: employee.pan ?? "",
      aadhaarNumber: employee.aadhaarNumber ?? "",
      bankAccountNumber: employee.bankAccountNumber ?? "",
      baseSalary: employee.baseSalary ?? 0,
      ctc: employee.ctc ?? 0,
      incentive: employee.incentive ?? 0,
      reimbursement: employee.reimbursement ?? 0,
      status: employee.status,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingEmployee(null);
    form.reset();
  };

  const columnHelper = useMemo(
    () => createColumnHelper<typeof tableFeatureSet, Employee>(),
    []
  );

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("employeeId", {
          header: "ID",
          cell: (info) => (
            <span className="font-mono text-xs">{info.getValue()}</span>
          ),
        }),
        columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
          id: "name",
          header: "Name",
          cell: (info) => (
            <div>
              <p className="font-medium">{info.getValue()}</p>
              <p className="text-xs text-muted-foreground">{info.row.original.email}</p>
            </div>
          ),
        }),
        columnHelper.accessor((row) => row.department?.name ?? "-", {
          id: "department",
          header: "Department",
        }),
        columnHelper.accessor((row) => row.orgRole?.name ?? row.role, {
          id: "role",
          header: "Role",
          cell: (info) => (
            <Badge variant="outline">
              {info.getValue()}
            </Badge>
          ),
        }),
        columnHelper.accessor("employmentType", {
          header: "Type",
          cell: (info) =>
            info.getValue().replace("_", " ").toLowerCase(),
        }),
        columnHelper.accessor("status", {
          header: "Status",
          cell: (info) => (
            <Badge className={cn("capitalize", statusColors[info.getValue()])}>
              {info.getValue().toLowerCase()}
            </Badge>
          ),
        }),
        columnHelper.accessor("joiningDate", {
          header: "Joined",
          cell: (info) => format(new Date(info.getValue()), "MMM d, yyyy"),
        }),
        ...(canCreateEmployee
          ? [
              columnHelper.display({
                id: "actions",
                header: "Actions",
                cell: ({ row }) => (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(row.original)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {row.original.status === "ACTIVE" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (
                            confirm(
                              `Mark ${row.original.firstName} ${row.original.lastName} as left? Their records will be preserved.`
                            )
                          ) {
                            deactivateMutation.mutate(row.original.id);
                          }
                        }}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ),
              }),
            ]
          : []),
      ]),
    [columnHelper, canCreateEmployee, deactivateMutation]
  );

  const table = useTable({
    features: tableFeatureSet,
    columns,
    data: employees,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <Users className="h-16 w-16 text-muted-foreground/60 mb-4" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground mt-2">
          Employee management is available to administrators and managers only.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-brand-600" />
            Employees
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your workforce directory
          </p>
        </div>
        {canCreateEmployee && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        )}
      </div>

      <Card glass>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Search & Filters</CardTitle>
          <CardDescription>Filter employees by department, role, and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or ID..."
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {employeeRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="LEFT">Left</SelectItem>
                <SelectItem value="TERMINATED">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3">
            <Select value={employmentFilter} onValueChange={setEmploymentFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Employment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="FULL_TIME">Full Time</SelectItem>
                <SelectItem value="PART_TIME">Part Time</SelectItem>
                <SelectItem value="CONTRACT">Contract</SelectItem>
                <SelectItem value="INTERN">Intern</SelectItem>
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
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id} className="border-b border-border/50">
                    {group.headers.map((header) => (
                      <th
                        key={header.id}
                        className="h-12 px-4 text-left font-medium text-muted-foreground"
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="flex items-center gap-1 hover:text-foreground"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <table.FlexRender header={header} />
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {columns.map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No employees found
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      {row.getAllCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          <table.FlexRender cell={cell} />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {employees.length} employee{employees.length !== 1 ? "s" : ""} total
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(v) =>
                  setPagination({ pageIndex: 0, pageSize: Number(v) })
                }
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                Page {pagination.pageIndex + 1} of{" "}
                {Math.max(1, table.getPageCount())}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "Edit Employee" : "Add Employee"}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee
                ? "Update employee information"
                : "Create a new employee account. Default password: Digitix@123"}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
            className="space-y-4"
          >
            {editingEmployee && session?.user?.role && isAdminOrHr(session.user.role) && (
              <ProfileAvatarUpload
                avatarUrl={editingEmployee.avatar}
                firstName={editingEmployee.firstName}
                lastName={editingEmployee.lastName}
                uploadUrl={`/api/employees/${editingEmployee.id}/avatar`}
                size="md"
                onUploaded={(avatarUrl) => {
                  setEditingEmployee((prev) =>
                    prev ? { ...prev, avatar: avatarUrl } : null
                  );
                  queryClient.invalidateQueries({ queryKey: ["employees"] });
                }}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" {...form.register("firstName")} />
                {form.formState.errors.firstName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" {...form.register("lastName")} />
                {form.formState.errors.lastName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...form.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="joiningDate">Joining Date</Label>
                <Input
                  id="joiningDate"
                  type="date"
                  {...form.register("joiningDate")}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={form.watch("orgRoleId") || undefined}
                  onValueChange={(v) => form.setValue("orgRoleId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeRoles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                        {!r.isSystem ? ` (${r.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.orgRoleId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.orgRoleId.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Includes Admin, HR, Manager, Employee, CEO, Delivery Manager, etc.
                  {" "}
                  <a href="/settings/roles" className="underline">
                    Manage roles
                  </a>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select
                  value={form.watch("employmentType")}
                  onValueChange={(v) =>
                    form.setValue(
                      "employmentType",
                      v as EmployeeInput["employmentType"]
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Full Time</SelectItem>
                    <SelectItem value="PART_TIME">Part Time</SelectItem>
                    <SelectItem value="CONTRACT">Contract</SelectItem>
                    <SelectItem value="INTERN">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={form.watch("departmentId") ?? "none"}
                  onValueChange={(v) =>
                    form.setValue("departmentId", v === "none" ? undefined : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Select
                  value={form.watch("designationId") ?? "none"}
                  onValueChange={(v) =>
                    form.setValue("designationId", v === "none" ? undefined : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select designation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {designations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  {...form.register("dateOfBirth")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Emergency Contact</Label>
                <Input
                  id="emergencyContact"
                  {...form.register("emergencyContact")}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/50 p-4">
              <p className="text-sm font-medium">Identity &amp; Bank Details</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pan">PAN Number</Label>
                  <Input
                    id="pan"
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className="uppercase"
                    {...form.register("pan", {
                      setValueAs: (v: string) => v?.toUpperCase() ?? "",
                    })}
                  />
                  {form.formState.errors.pan && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.pan.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aadhaarNumber">Aadhaar Number</Label>
                  <Input
                    id="aadhaarNumber"
                    placeholder="12-digit Aadhaar"
                    maxLength={12}
                    inputMode="numeric"
                    {...form.register("aadhaarNumber")}
                  />
                  {form.formState.errors.aadhaarNumber && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.aadhaarNumber.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankAccountNumber">Bank Account Number</Label>
                <Input
                  id="bankAccountNumber"
                  placeholder="9–18 digit account number"
                  inputMode="numeric"
                  {...form.register("bankAccountNumber")}
                />
                {form.formState.errors.bankAccountNumber && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.bankAccountNumber.message}
                  </p>
                )}
              </div>
            </div>

            {canEditSalary && (
              <div className="space-y-3 rounded-xl border border-border/50 p-4">
                <p className="text-sm font-medium">Compensation (defaults for payslip)</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ctc">CTC (Cost to Company)</Label>
                    <Input
                      id="ctc"
                      type="number"
                      min={0}
                      step={0.01}
                      {...form.register("ctc", { valueAsNumber: true })}
                    />
                    {form.formState.errors.ctc && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.ctc.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="baseSalary">Basic Salary</Label>
                    <Input
                      id="baseSalary"
                      type="number"
                      min={0}
                      step={0.01}
                      {...form.register("baseSalary", { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="incentive">Incentive</Label>
                    <Input
                      id="incentive"
                      type="number"
                      min={0}
                      step={0.01}
                      {...form.register("incentive", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reimbursement">Reimbursement</Label>
                    <Input
                      id="reimbursement"
                      type="number"
                      min={0}
                      step={0.01}
                      {...form.register("reimbursement", { valueAsNumber: true })}
                    />
                  </div>
                </div>
                {editingEmployee && (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <Label>Employment Status</Label>
                    <Select
                      value={form.watch("status") ?? editingEmployee.status}
                      onValueChange={(v) =>
                        form.setValue("status", v as EmployeeInput["status"])
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="LEFT">Left</SelectItem>
                        <SelectItem value="TERMINATED">Terminated</SelectItem>
                      </SelectContent>
                    </Select>
                    {editingEmployee.ctc != null && editingEmployee.ctc > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Current CTC: {formatCurrency(editingEmployee.ctc)}
                      </p>
                    )}
                  </div>
                )}
                {editingEmployee &&
                  editingDependents?.enabled &&
                  editingDependents.dependents.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <p className="text-sm font-medium">Dependent / Insurance Details</p>
                      <div className="space-y-2">
                        {editingDependents.dependents.map((dep) => (
                          <div
                            key={dep.id}
                            className="rounded-lg bg-muted/40 px-3 py-2 text-sm"
                          >
                            <p className="font-medium">{dep.name}</p>
                            <p className="text-muted-foreground">
                              {dep.relationship}
                              {dep.gender ? ` · ${dep.gender}` : ""}
                              {dep.dateOfBirth
                                ? ` · DOB ${format(new Date(dep.dateOfBirth), "MMM d, yyyy")}`
                                : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editingEmployee ? "Save Changes" : "Create Employee"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
