import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { assignManagerSchema } from "@/lib/validations";
import { canManageOrgHierarchy } from "@/lib/permissions";
import {
  assignEmployeeManager,
  buildOrgTree,
  fetchOrgEmployees,
  filterOrgTree,
  getReportingHistory,
} from "@/lib/org-hierarchy";

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error || !user) return error;

  if (!canManageOrgHierarchy(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const search = request.nextUrl.searchParams.get("search") ?? "";
    const userId = request.nextUrl.searchParams.get("userId");

    if (userId) {
      const employee = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          managerId: true,
          department: { select: { name: true } },
          designation: { select: { name: true } },
          manager: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              role: true,
              status: true,
            },
          },
          teamMembers: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              role: true,
              status: true,
              designation: { select: { name: true } },
            },
            orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
          },
        },
      });

      if (!employee) {
        return apiError("Employee not found", 404);
      }

      const history = await getReportingHistory(userId);

      return apiSuccess({ employee, history });
    }

    const employees = await fetchOrgEmployees(true);
    const tree = buildOrgTree(employees);
    const filtered = filterOrgTree(tree, search);

    const managerOptions = employees
      .filter((e) => e.status === "ACTIVE")
      .map((e) => ({
        id: e.id,
        employeeId: e.employeeId,
        firstName: e.firstName,
        lastName: e.lastName,
        role: e.role,
      }));

    return apiSuccess({ tree: filtered, employees: managerOptions });
  } catch (err) {
    console.error("Org hierarchy GET error:", err);
    return apiError("Failed to load organization hierarchy", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error || !user) return error;

  if (!canManageOrgHierarchy(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = assignManagerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 400);
    }

    const effectiveFrom = parsed.data.effectiveFrom
      ? new Date(parsed.data.effectiveFrom)
      : new Date();

    if (Number.isNaN(effectiveFrom.getTime())) {
      return apiError("Invalid effective date", 400);
    }

    const managerId =
      parsed.data.managerId === undefined
        ? null
        : parsed.data.managerId || null;

    const updated = await assignEmployeeManager({
      userId: parsed.data.userId,
      managerId,
      effectiveFrom,
      changedById: user.id,
    });

    const employee = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { firstName: true, lastName: true },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: parsed.data.userId,
      details: `Updated reporting manager for ${employee?.firstName ?? ""} ${employee?.lastName ?? ""}`,
    });

    return apiSuccess(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update reporting manager";
    return apiError(message, 400);
  }
}
