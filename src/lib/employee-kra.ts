import { RoleName } from "@prisma/client";
import { isAdminOrHr } from "@/lib/permissions";

export const KRA_WEIGHT_TARGET = 100;

export interface KraWeightSummary {
  total: number;
  remaining: number;
  excess: number;
  isValid: boolean;
}

export function summarizeKraWeights(weights: number[]): KraWeightSummary {
  const total = Math.round(weights.reduce((sum, w) => sum + w, 0) * 100) / 100;
  const remaining = Math.round((KRA_WEIGHT_TARGET - total) * 100) / 100;
  const excess = total > KRA_WEIGHT_TARGET ? Math.round((total - KRA_WEIGHT_TARGET) * 100) / 100 : 0;
  return {
    total,
    remaining: remaining > 0 ? remaining : 0,
    excess,
    isValid: Math.abs(total - KRA_WEIGHT_TARGET) < 0.01,
  };
}

export function kraWeightMessage(summary: KraWeightSummary) {
  if (summary.isValid) {
    return `Total Weight: ${summary.total}% — Ready to finalize`;
  }
  if (summary.excess > 0) {
    return `Total Weight: ${summary.total}% — Weight exceeds 100% by ${summary.excess}%`;
  }
  return `Total Weight: ${summary.total}% — ${summary.remaining}% remaining`;
}

export async function canManageEmployeeKra(
  role: RoleName,
  actorId: string,
  employee: { id: string; managerId: string | null }
) {
  if (isAdminOrHr(role)) return true;
  if (role === RoleName.MANAGER && employee.managerId === actorId) return true;
  return false;
}

export function canConfigureKra(role: RoleName) {
  return role === RoleName.ADMIN || role === RoleName.HR || role === RoleName.MANAGER;
}
