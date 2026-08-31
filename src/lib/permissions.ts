import type { RoleName } from "@prisma/client";

export function isAdmin(role: RoleName) {
  return role === "ADMIN";
}

export function isHr(role: RoleName) {
  return role === "HR";
}

export function isAdminOrHr(role: RoleName) {
  return role === "ADMIN" || role === "HR";
}

export function isManagerRole(role: RoleName) {
  return role === "MANAGER";
}

/** Can approve/reject team or org leave requests */
export function canApproveLeave(role: RoleName) {
  return role === "ADMIN" || role === "HR" || role === "MANAGER";
}

export function canManageAllLeaves(role: RoleName) {
  return isAdminOrHr(role);
}

export function canViewAllSalaries(role: RoleName) {
  return isAdminOrHr(role);
}

export function canManageEmployees(role: RoleName) {
  return isAdminOrHr(role) || role === "MANAGER";
}

export function canManagePolicies(role: RoleName) {
  return isAdminOrHr(role);
}

export function canViewPolicies(role: RoleName) {
  return role === "ADMIN" || role === "HR" || role === "MANAGER" || role === "EMPLOYEE";
}

export function canManageEmployeeDocuments(role: RoleName) {
  return isAdminOrHr(role);
}

export function canViewOwnDocuments(role: RoleName) {
  return role === "ADMIN" || role === "HR" || role === "MANAGER" || role === "EMPLOYEE";
}

export function canViewEmployeeDependents(role: RoleName) {
  return isAdminOrHr(role);
}

export function canViewLateAttendance(role: RoleName) {
  return isAdminOrHr(role);
}

export function canEditLeaveBalance(role: RoleName) {
  return isAdminOrHr(role);
}

export function canApplyLeaveOnBehalf(role: RoleName) {
  return isAdminOrHr(role);
}

export function canUploadPayslip(role: RoleName) {
  return isAdminOrHr(role);
}

export function canAccessCompanySettings(role: RoleName) {
  return role === "ADMIN";
}

export function canAccessDepartments(role: RoleName) {
  return role === "ADMIN";
}

export function canManageOrgHierarchy(role: RoleName) {
  return role === "ADMIN";
}

export function canViewTeam(role: RoleName) {
  return role === "ADMIN" || role === "HR" || role === "MANAGER";
}

export function canAccessReports(role: RoleName) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canGeneratePayslip(role: RoleName) {
  return isAdminOrHr(role);
}

export function canManageWorkSchedules(role: RoleName) {
  return role === "ADMIN";
}

export function canBulkImportLeave(role: RoleName) {
  return role === "ADMIN";
}

export function canBulkImportEmployees(role: RoleName) {
  return role === "ADMIN";
}

export function canExportEmployees(role: RoleName) {
  return role === "ADMIN";
}

export function canAccessWorkSchedules(role: RoleName) {
  return canManageWorkSchedules(role) || isManagerRole(role);
}

export function canBulkManageWorkSchedules(role: RoleName) {
  return canManageWorkSchedules(role);
}

export function canAccessKra(role: RoleName) {
  return role === "ADMIN" || role === "HR" || role === "MANAGER" || role === "EMPLOYEE";
}

export function canReviewKra(role: RoleName) {
  return role === "ADMIN" || role === "HR" || role === "MANAGER";
}

export function canReopenKra(role: RoleName) {
  return role === "ADMIN" || role === "HR";
}

export function canConfigureKra(role: RoleName) {
  return role === "ADMIN" || role === "HR" || role === "MANAGER";
}

/** @deprecated Use canApproveLeave — kept for minimal diff in existing imports */
export function isManager(role: RoleName) {
  return canApproveLeave(role);
}

export const ADMIN_HR: RoleName[] = ["ADMIN", "HR"];
export const ADMIN_HR_MANAGER: RoleName[] = ["ADMIN", "HR", "MANAGER"];
export const ALL_ROLES: RoleName[] = ["ADMIN", "HR", "MANAGER", "EMPLOYEE"];
