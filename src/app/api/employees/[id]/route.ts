import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { employeeSchema } from "@/lib/validations";
import { resolveOrgRole } from "@/lib/employee-roles";
import { normalizeEmail } from "@/lib/email-utils";

type RouteContext = { params: Promise<{ id: string }> };

const employeeSelect = {
  id: true,
  employeeId: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  orgRoleId: true,
  employmentType: true,
  status: true,
  joiningDate: true,
  dateOfBirth: true,
  emergencyContact: true,
  pan: true,
  aadhaarNumber: true,
  bankName: true,
  bankAccountNumber: true,
  ifscCode: true,
  baseSalary: true,
  ctc: true,
  incentive: true,
  reimbursement: true,
  departmentId: true,
  designationId: true,
  managerId: true,
  orgRole: { select: { id: true, name: true, code: true, accessLevel: true } },
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  manager: { select: { id: true, firstName: true, lastName: true } },
  profileEditingEnabled: true,
} as const;

export async function GET(_req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN", "HR", "MANAGER"]);
  if (error) return error;

  const { id } = await context.params;

  const employee = await prisma.user.findUnique({
    where: { id },
    select: employeeSelect,
  });

  if (!employee) return apiError("Employee not found", 404);

  if (user!.role === "MANAGER" && employee.managerId !== user!.id && employee.id !== user!.id) {
    return apiError("Forbidden", 403);
  }

  return apiSuccess(employee);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN", "HR"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const body = await req.json();
    const parsed = employeeSchema.parse(body);
    const email = normalizeEmail(parsed.email);

    const existing = await prisma.user.findFirst({
      where: { email, NOT: { id } },
    });
    if (existing) {
      return apiError("An employee with this email already exists", 409);
    }

    const orgRole = await resolveOrgRole(parsed.orgRoleId);

    const updateData: Parameters<typeof prisma.user.update>[0]["data"] = {
      email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      phone: parsed.phone,
      role: orgRole.accessLevel,
      orgRoleId: orgRole.id,
      employmentType: parsed.employmentType,
      departmentId: parsed.departmentId || null,
      designationId: parsed.designationId || null,
      managerId: parsed.managerId || null,
      joiningDate: new Date(parsed.joiningDate),
      dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null,
      emergencyContact: parsed.emergencyContact,
      pan: parsed.pan || null,
      aadhaarNumber: parsed.aadhaarNumber || null,
      bankName: parsed.bankName?.trim() || null,
      bankAccountNumber: parsed.bankAccountNumber || null,
      ifscCode: parsed.ifscCode?.toUpperCase() || null,
      baseSalary: parsed.baseSalary ?? 0,
      ctc: parsed.ctc ?? 0,
      incentive: parsed.incentive ?? 0,
      reimbursement: parsed.reimbursement ?? 0,
      ...(parsed.status ? { status: parsed.status } : {}),
    };

    if (user!.role === "ADMIN" && parsed.profileEditingEnabled !== undefined) {
      updateData.profileEditingEnabled = parsed.profileEditingEnabled;
    }

    if (user!.role === "ADMIN" && parsed.employeeId?.trim()) {
      const employeeId = parsed.employeeId.trim();
      const existingEmployeeId = await prisma.user.findFirst({
        where: { employeeId, NOT: { id } },
      });
      if (existingEmployeeId) {
        return apiError("An employee with this ID already exists", 409);
      }
      updateData.employeeId = employeeId;
    }

    const employee = await prisma.user.update({
      where: { id },
      data: updateData,
      select: employeeSelect,
    });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "User",
      entityId: employee.id,
      details: `Updated employee ${employee.firstName} ${employee.lastName}`,
    });

    return apiSuccess(employee);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return apiError("Invalid employee data", 422);
    }
    if (err instanceof Error && err.message.includes("role")) {
      return apiError(err.message, 400);
    }
    if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
      return apiError("Employee not found", 404);
    }
    console.error(err);
    return apiError("Failed to update employee", 500);
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth(["ADMIN", "HR"]);
  if (error) return error;

  const { id } = await context.params;

  try {
    const employee = await prisma.user.update({
      where: { id },
      data: { status: "LEFT" },
      select: { id: true, firstName: true, lastName: true },
    });

    await createAuditLog({
      userId: user!.id,
      action: "DELETE",
      entity: "User",
      entityId: employee.id,
      details: `Marked employee ${employee.firstName} ${employee.lastName} as left`,
    });

    return apiSuccess({ id: employee.id });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
      return apiError("Employee not found", 404);
    }
    return apiError("Failed to deactivate employee", 500);
  }
}
