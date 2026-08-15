import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  apiSuccess,
  apiError,
  createAuditLog,
} from "@/lib/api-utils";
import { employeeSchema } from "@/lib/validations";
import type { Prisma } from "@prisma/client";

function generateEmployeeId() {
  return `EMP${Date.now().toString().slice(-8)}`;
}

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "HR", "MANAGER"]);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const departmentId = searchParams.get("departmentId");
  const role = searchParams.get("role");
  const status = searchParams.get("status");
  const employmentType = searchParams.get("employmentType");
  const activeOnly = searchParams.get("activeOnly") === "true";

  const where: Prisma.UserWhereInput = {};

  if (activeOnly) {
    where.status = "ACTIVE";
  }

  if (user!.role === "MANAGER") {
    where.OR = [{ managerId: user!.id }, { id: user!.id }];
  }

  if (search) {
    const searchFilter: Prisma.UserWhereInput = {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { employeeId: { contains: search, mode: "insensitive" } },
      ],
    };
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), searchFilter];
  }

  if (departmentId) where.departmentId = departmentId;
  if (role) where.role = role as Prisma.EnumRoleNameFilter["equals"];
  if (status) where.status = status as Prisma.EnumUserStatusFilter["equals"];
  if (employmentType) {
    where.employmentType = employmentType as Prisma.EnumEmploymentTypeFilter["equals"];
  }

  const employees = await prisma.user.findMany({
    where,
    select: {
      id: true,
      employeeId: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatar: true,
      role: true,
      employmentType: true,
      status: true,
      joiningDate: true,
      dateOfBirth: true,
      emergencyContact: true,
      pan: true,
      baseSalary: true,
      ctc: true,
      incentive: true,
      reimbursement: true,
      departmentId: true,
      designationId: true,
      managerId: true,
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(employees);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "HR"]);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = employeeSchema.parse(body);

    const existing = await prisma.user.findUnique({
      where: { email: parsed.email },
    });
    if (existing) {
      return apiError("An employee with this email already exists", 409);
    }

    const defaultPassword = await bcrypt.hash("Digitix@123", 12);

    const employee = await prisma.user.create({
      data: {
        employeeId: generateEmployeeId(),
        email: parsed.email,
        password: defaultPassword,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        phone: parsed.phone,
        role: parsed.role,
        employmentType: parsed.employmentType,
        departmentId: parsed.departmentId || null,
        designationId: parsed.designationId || null,
        managerId: parsed.managerId || null,
        joiningDate: new Date(parsed.joiningDate),
        dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : null,
        emergencyContact: parsed.emergencyContact,
        pan: parsed.pan || null,
        baseSalary: parsed.baseSalary ?? 0,
        ctc: parsed.ctc ?? 0,
        incentive: parsed.incentive ?? 0,
        reimbursement: parsed.reimbursement ?? 0,
        mustChangePassword: true,
      },
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        employmentType: true,
        status: true,
        joiningDate: true,
        dateOfBirth: true,
        emergencyContact: true,
        pan: true,
        baseSalary: true,
        ctc: true,
        incentive: true,
        reimbursement: true,
        departmentId: true,
        designationId: true,
        managerId: true,
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await createAuditLog({
      userId: user!.id,
      action: "CREATE",
      entity: "User",
      entityId: employee.id,
      details: `Created employee ${employee.firstName} ${employee.lastName}`,
    });

    return apiSuccess(employee, 201);
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return apiError("Invalid employee data", 422);
    }
    console.error(err);
    return apiError("Failed to create employee", 500);
  }
}
