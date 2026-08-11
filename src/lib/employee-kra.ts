import { RoleName } from "@prisma/client";
import { isAdminOrHr } from "@/lib/permissions";

export const KRA_WEIGHT_TARGET = 100;

export interface KraWeightSummary {
  total: number;
  remaining: number;
  excess: number;
  isValid: boolean;
  weightedCount: number;
  qualitativeCount: number;
}

export function summarizeKraWeights(weights: (number | null | undefined)[]): KraWeightSummary {
  const weighted = weights.filter((w): w is number => w !== null && w !== undefined && w > 0);
  const total = Math.round(weighted.reduce((sum, w) => sum + w, 0) * 100) / 100;
  const remaining = Math.round((KRA_WEIGHT_TARGET - total) * 100) / 100;
  const excess =
    total > KRA_WEIGHT_TARGET ? Math.round((total - KRA_WEIGHT_TARGET) * 100) / 100 : 0;
  return {
    total,
    remaining: remaining > 0 ? remaining : 0,
    excess,
    isValid: weighted.length > 0 && Math.abs(total - KRA_WEIGHT_TARGET) < 0.01,
    weightedCount: weighted.length,
    qualitativeCount: weights.length - weighted.length,
  };
}

export function kraWeightMessage(summary: KraWeightSummary) {
  const qualitativeNote =
    summary.qualitativeCount > 0
      ? ` (${summary.qualitativeCount} qualitative KRA${summary.qualitativeCount > 1 ? "s" : ""} not counted)`
      : "";

  if (summary.isValid) {
    return `Total Weight: ${summary.total}% — Ready to finalize${qualitativeNote}`;
  }
  if (summary.excess > 0) {
    return `Total Weight: ${summary.total}% — Weight exceeds 100% by ${summary.excess}%${qualitativeNote}`;
  }
  return `Total Weight: ${summary.total}% — ${summary.remaining}% remaining${qualitativeNote}`;
}

export function formatKraWeight(weight: number | null | undefined) {
  if (weight === null || weight === undefined) return "N/A";
  return `${weight}%`;
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
