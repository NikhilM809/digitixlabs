/** Canonical permission slugs grouped by HRMS module */
export const PERMISSION_MODULES = {
  employees: {
    label: "Employees",
    permissions: [
      { name: "employees.view", action: "view", description: "View employees" },
      { name: "employees.create", action: "create", description: "Create employees" },
      { name: "employees.edit", action: "edit", description: "Edit employees" },
      { name: "employees.delete", action: "delete", description: "Delete employees" },
      { name: "employees.export", action: "export", description: "Export employee data" },
    ],
  },
  attendance: {
    label: "Attendance",
    permissions: [
      { name: "attendance.view", action: "view", description: "View attendance" },
      { name: "attendance.edit", action: "edit", description: "Edit attendance" },
      { name: "attendance.approve", action: "approve", description: "Approve attendance" },
      { name: "attendance.manage_policies", action: "manage", description: "Manage attendance policies" },
    ],
  },
  leave: {
    label: "Leave",
    permissions: [
      { name: "leave.view", action: "view", description: "View leave requests" },
      { name: "leave.apply_on_behalf", action: "create", description: "Apply leave on behalf of employee" },
      { name: "leave.approve", action: "approve", description: "Approve/reject leave" },
      { name: "leave.manage_policies", action: "manage", description: "Manage leave policies" },
    ],
  },
  payroll: {
    label: "Payroll",
    permissions: [
      { name: "payroll.view", action: "view", description: "View payroll" },
      { name: "payroll.create", action: "create", description: "Create payroll" },
      { name: "payroll.edit", action: "edit", description: "Edit payroll" },
      { name: "payroll.approve", action: "approve", description: "Approve payroll" },
      { name: "payroll.export", action: "export", description: "Export payroll" },
    ],
  },
  performance: {
    label: "Performance",
    permissions: [
      { name: "performance.view", action: "view", description: "View performance" },
      { name: "performance.create_appraisal", action: "create", description: "Create appraisal" },
      { name: "performance.review", action: "review", description: "Review appraisal" },
      { name: "performance.approve", action: "approve", description: "Approve appraisal" },
    ],
  },
  recruitment: {
    label: "Recruitment",
    permissions: [
      { name: "recruitment.view_candidates", action: "view", description: "View candidates" },
      { name: "recruitment.create_jobs", action: "create", description: "Create job openings" },
      { name: "recruitment.manage_candidates", action: "edit", description: "Manage candidates" },
      { name: "recruitment.schedule_interviews", action: "manage", description: "Schedule interviews" },
      { name: "recruitment.hiring_decisions", action: "approve", description: "Make hiring decisions" },
    ],
  },
  reports: {
    label: "Reports",
    permissions: [
      { name: "reports.view", action: "view", description: "View reports" },
      { name: "reports.export", action: "export", description: "Export reports" },
      { name: "reports.custom", action: "create", description: "Create custom reports" },
    ],
  },
  admin: {
    label: "Administration",
    permissions: [
      { name: "admin.manage_users", action: "manage", description: "Manage users" },
      { name: "admin.manage_roles", action: "manage", description: "Manage roles" },
      { name: "admin.manage_permissions", action: "manage", description: "Manage permissions" },
      { name: "admin.manage_departments", action: "manage", description: "Manage departments" },
      { name: "admin.manage_settings", action: "manage", description: "Manage company settings" },
    ],
  },
} as const;

export type PermissionSlug =
  (typeof PERMISSION_MODULES)[keyof typeof PERMISSION_MODULES]["permissions"][number]["name"];

export const ALL_PERMISSION_DEFINITIONS = Object.entries(PERMISSION_MODULES).flatMap(
  ([module, { permissions }]) =>
    permissions.map((p) => ({
      ...p,
      module,
    }))
);

export const ALL_PERMISSION_SLUGS = ALL_PERMISSION_DEFINITIONS.map((p) => p.name);

/** Permissions that must not be fully removed from the acting admin */
export const CRITICAL_ADMIN_PERMISSIONS = [
  "admin.manage_roles",
  "admin.manage_permissions",
] as const;

export function slugToCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function roleNameToCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Map legacy enum roles to default permission sets */
export const SYSTEM_ROLE_PERMISSIONS: Record<
  "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE",
  PermissionSlug[]
> = {
  ADMIN: [...ALL_PERMISSION_SLUGS],
  HR: [
    "employees.view",
    "employees.create",
    "employees.edit",
    "employees.export",
    "attendance.view",
    "attendance.edit",
    "attendance.approve",
    "leave.view",
    "leave.apply_on_behalf",
    "leave.approve",
    "leave.manage_policies",
    "payroll.view",
    "payroll.create",
    "payroll.edit",
    "payroll.export",
    "performance.view",
    "performance.create_appraisal",
    "performance.review",
    "performance.approve",
    "reports.view",
    "reports.export",
    "admin.manage_users",
  ],
  MANAGER: [
    "employees.view",
    "attendance.view",
    "leave.view",
    "leave.approve",
    "payroll.view",
    "performance.view",
    "performance.review",
    "reports.view",
  ],
  EMPLOYEE: [
    "employees.view",
    "attendance.view",
    "leave.view",
    "payroll.view",
    "performance.view",
  ],
};

export const SYSTEM_ROLE_LABELS: Record<"ADMIN" | "HR" | "MANAGER" | "EMPLOYEE", string> = {
  ADMIN: "Super Admin",
  HR: "HR",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};
