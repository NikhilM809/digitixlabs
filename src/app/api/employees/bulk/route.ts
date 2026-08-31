import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, createAuditLog } from "@/lib/api-utils";
import { canExportEmployees, canBulkImportEmployees } from "@/lib/permissions";
import {
  buildExcelBuffer,
  getRowValue,
  parseExcelBuffer,
  parseOptionalNumber,
} from "@/lib/excel-utils";
import { resolveOrgRole } from "@/lib/employee-roles";
import type { EmploymentType, UserStatus } from "@prisma/client";

const DEFAULT_PASSWORD = "Digitix@123";

const employeeExportSelect = {
  employeeId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  employmentType: true,
  status: true,
  joiningDate: true,
  pan: true,
  aadhaarNumber: true,
  bankName: true,
  bankAccountNumber: true,
  ifscCode: true,
  baseSalary: true,
  hra: true,
  specialAllowance: true,
  internetAllowance: true,
  performanceBonus: true,
  ctc: true,
  incentive: true,
  reimbursement: true,
  orgRole: { select: { code: true } },
  department: { select: { name: true } },
  designation: { select: { name: true } },
  manager: { select: { employeeId: true } },
} as const;

type ExportedEmployee = Awaited<
  ReturnType<typeof prisma.user.findMany<{ select: typeof employeeExportSelect }>>
>[number];

function formatExportRow(e: ExportedEmployee) {
  return {
    "Employee ID": e.employeeId,
    "First Name": e.firstName,
    "Last Name": e.lastName,
    Email: e.email,
    Phone: e.phone ?? "",
    "Role Code": e.orgRole?.code ?? "EMPLOYEE",
    "Employment Type": e.employmentType,
    Department: e.department?.name ?? "",
    Designation: e.designation?.name ?? "",
    "Manager Employee ID": e.manager?.employeeId ?? "",
    "Joining Date": e.joiningDate.toISOString().split("T")[0],
    Status: e.status,
    PAN: e.pan ?? "",
    Aadhaar: e.aadhaarNumber ?? "",
    "Bank Name": e.bankName ?? "",
    "Bank Account": e.bankAccountNumber ?? "",
    IFSC: e.ifscCode ?? "",
    "Base Salary": e.baseSalary ?? 0,
    HRA: e.hra ?? 0,
    "Special Allowance": e.specialAllowance ?? 0,
    "Internet Allowance": e.internetAllowance ?? 0,
    "Performance Bonus": e.performanceBonus ?? 0,
    CTC: e.ctc ?? 0,
  };
}

export async function GET(request: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error || !user) return error;

  if (!canExportEmployees(user.role)) {
    return apiError("Forbidden", 403);
  }

  const templateOnly = request.nextUrl.searchParams.get("template") === "true";

  if (templateOnly) {
    const buffer = buildExcelBuffer(
      [
        {
          "Employee ID": "DXL0006",
          "First Name": "Jane",
          "Last Name": "Doe",
          Email: "jane.doe@digitixlabs.com",
          Phone: "9876543210",
          "Role Code": "EMPLOYEE",
          "Employment Type": "FULL_TIME",
          Department: "Survey Programing",
          Designation: "Analyst",
          "Manager Employee ID": "DXL00001",
          "Joining Date": "2026-01-15",
          Status: "ACTIVE",
          PAN: "0",
          Aadhaar: "0",
          "Bank Name": "0",
          "Bank Account": "0",
          IFSC: "0",
          "Base Salary": 0,
          HRA: 0,
          "Special Allowance": 0,
          "Internet Allowance": 0,
          "Performance Bonus": 0,
          CTC: 0,
        },
      ],
      "EmployeeTemplate"
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="employee-import-template.xlsx"',
      },
    });
  }

  const employees = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: employeeExportSelect,
    orderBy: { employeeId: "asc" },
  });

  const rows = employees.map(formatExportRow);
  const buffer = buildExcelBuffer(rows, "Employees");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="employees.xlsx"',
    },
  });
}

interface ValidImportRow {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  orgRoleId: string;
  employmentType: EmploymentType;
  departmentId?: string | null;
  designationId?: string | null;
  managerId?: string | null;
  joiningDate: Date;
  status: UserStatus;
  pan?: string | null;
  aadhaarNumber?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  ifscCode?: string | null;
  baseSalary: number;
  hra: number;
  specialAllowance: number;
  internetAllowance: number;
  performanceBonus: number;
  ctc: number;
  isUpdate: boolean;
  userId?: string;
}

export async function POST(request: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error || !user) return error;

  if (!canBulkImportEmployees(user.role)) {
    return apiError("Forbidden", 403);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const confirm = formData.get("confirm") === "true";

    if (!file || !(file instanceof Blob)) {
      return apiError("Excel file is required", 400);
    }

    const rawRows = parseExcelBuffer(await file.arrayBuffer());
    const errors: { row: number; message: string }[] = [];
    const validRows: ValidImportRow[] = [];
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();

    const [departments, designations, roles, employees] = await Promise.all([
      prisma.department.findMany({ select: { id: true, name: true } }),
      prisma.designation.findMany({ select: { id: true, name: true } }),
      prisma.employeeRoleDefinition.findMany({
        where: { isActive: true },
        select: { id: true, code: true },
      }),
      prisma.user.findMany({
        select: { id: true, employeeId: true, email: true },
      }),
    ]);

    const deptMap = new Map(
      departments.map((d) => [d.name.trim().toLowerCase(), d.id])
    );
    const desigMap = new Map(
      designations.map((d) => [d.name.trim().toLowerCase(), d.id])
    );
    const roleMap = new Map(roles.map((r) => [r.code.toUpperCase(), r.id]));
    const empById = new Map(employees.map((e) => [e.employeeId.toUpperCase(), e]));
    const empByEmail = new Map(employees.map((e) => [e.email.toLowerCase(), e]));

    rawRows.forEach((row, index) => {
      const rowNum = index + 2;
      const employeeId = getRowValue(row, "Employee ID", "employee_id", "employeeId");
      const firstName = getRowValue(row, "First Name", "first_name", "firstName");
      const lastName = getRowValue(row, "Last Name", "last_name", "lastName");
      const email = getRowValue(row, "Email", "email").toLowerCase();

      if (!employeeId && !email && !firstName) return;

      if (!employeeId) {
        errors.push({ row: rowNum, message: "Employee ID is required" });
        return;
      }
      if (!firstName || !lastName) {
        errors.push({ row: rowNum, message: "First name and last name are required" });
        return;
      }
      if (!email) {
        errors.push({ row: rowNum, message: "Email is required" });
        return;
      }

      const idKey = employeeId.toUpperCase();
      if (seenIds.has(idKey)) {
        errors.push({ row: rowNum, message: `Duplicate Employee ID ${employeeId}` });
        return;
      }
      if (seenEmails.has(email)) {
        errors.push({ row: rowNum, message: `Duplicate email ${email}` });
        return;
      }
      seenIds.add(idKey);
      seenEmails.add(email);

      const roleCode = getRowValue(row, "Role Code", "role_code", "roleCode") || "EMPLOYEE";
      const orgRoleId = roleMap.get(roleCode.toUpperCase());
      if (!orgRoleId) {
        errors.push({ row: rowNum, message: `Unknown role code ${roleCode}` });
        return;
      }

      const employmentType = (getRowValue(
        row,
        "Employment Type",
        "employment_type",
        "employmentType"
      ) || "FULL_TIME") as EmploymentType;
      if (!["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"].includes(employmentType)) {
        errors.push({ row: rowNum, message: "Invalid employment type" });
        return;
      }

      const status = (getRowValue(row, "Status", "status") || "ACTIVE") as UserStatus;
      if (!["ACTIVE", "LEFT", "TERMINATED"].includes(status)) {
        errors.push({ row: rowNum, message: "Invalid status" });
        return;
      }

      const joiningDateStr = getRowValue(row, "Joining Date", "joining_date", "joiningDate");
      if (!joiningDateStr) {
        errors.push({ row: rowNum, message: "Joining date is required (YYYY-MM-DD)" });
        return;
      }
      const joiningDate = new Date(`${joiningDateStr}T00:00:00.000Z`);
      if (Number.isNaN(joiningDate.getTime())) {
        errors.push({ row: rowNum, message: "Invalid joining date" });
        return;
      }

      const deptName = getRowValue(row, "Department", "department");
      const desigName = getRowValue(row, "Designation", "designation");
      const managerEmployeeId = getRowValue(
        row,
        "Manager Employee ID",
        "manager_employee_id",
        "managerEmployeeId"
      );

      let managerId: string | null = null;
      if (managerEmployeeId) {
        const manager = empById.get(managerEmployeeId.toUpperCase());
        if (!manager) {
          errors.push({
            row: rowNum,
            message: `Manager Employee ID ${managerEmployeeId} not found`,
          });
          return;
        }
        managerId = manager.id;
      }

      const existingById = empById.get(idKey);
      const existingByEmail = empByEmail.get(email);
      if (existingByEmail && existingById && existingByEmail.id !== existingById.id) {
        errors.push({ row: rowNum, message: "Email belongs to a different employee" });
        return;
      }
      if (existingByEmail && !existingById) {
        errors.push({
          row: rowNum,
          message: "Email already used by another employee ID",
        });
        return;
      }

      validRows.push({
        employeeId,
        firstName,
        lastName,
        email,
        phone: getRowValue(row, "Phone", "phone") || undefined,
        orgRoleId,
        employmentType,
        departmentId: deptName ? deptMap.get(deptName.toLowerCase()) ?? null : null,
        designationId: desigName ? desigMap.get(desigName.toLowerCase()) ?? null : null,
        managerId,
        joiningDate,
        status,
        pan: getRowValue(row, "PAN", "pan") || null,
        aadhaarNumber: getRowValue(row, "Aadhaar", "aadhaar") || null,
        bankName: getRowValue(row, "Bank Name", "bank_name", "bankName") || null,
        bankAccountNumber:
          getRowValue(row, "Bank Account", "bank_account", "bankAccountNumber") || null,
        ifscCode: getRowValue(row, "IFSC", "ifsc")?.toUpperCase() || null,
        baseSalary: parseOptionalNumber(getRowValue(row, "Base Salary", "base_salary")) ?? 0,
        hra: parseOptionalNumber(getRowValue(row, "HRA", "hra")) ?? 0,
        specialAllowance:
          parseOptionalNumber(
            getRowValue(row, "Special Allowance", "special_allowance", "specialAllowance")
          ) ??
          parseOptionalNumber(getRowValue(row, "Incentive", "incentive")) ??
          0,
        internetAllowance:
          parseOptionalNumber(
            getRowValue(row, "Internet Allowance", "internet_allowance", "internetAllowance")
          ) ??
          parseOptionalNumber(getRowValue(row, "Reimbursement", "reimbursement")) ??
          0,
        performanceBonus:
          parseOptionalNumber(
            getRowValue(row, "Performance Bonus", "performance_bonus", "performanceBonus")
          ) ?? 0,
        ctc: parseOptionalNumber(getRowValue(row, "CTC", "ctc")) ?? 0,
        isUpdate: !!existingById,
        userId: existingById?.id,
      });
    });

    if (validRows.length === 0) {
      return apiError("No valid employee rows found", 400);
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 422 });
    }

    if (!confirm) {
      return NextResponse.json({
        success: true,
        preview: validRows.map((r) => ({
          employeeId: r.employeeId,
          name: `${r.firstName} ${r.lastName}`,
          email: r.email,
          action: r.isUpdate ? "update" : "create",
        })),
        message: "Validation passed. Set confirm=true to apply changes.",
      });
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    let created = 0;
    let updated = 0;

    for (const row of validRows) {
      const orgRole = await resolveOrgRole(row.orgRoleId);

      if (row.isUpdate && row.userId) {
        await prisma.user.update({
          where: { id: row.userId },
          data: {
            employeeId: row.employeeId,
            email: row.email,
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone,
            role: orgRole.accessLevel,
            orgRoleId: orgRole.id,
            employmentType: row.employmentType,
            departmentId: row.departmentId,
            designationId: row.designationId,
            managerId: row.managerId,
            joiningDate: row.joiningDate,
            status: row.status,
            pan: row.pan,
            aadhaarNumber: row.aadhaarNumber,
            bankName: row.bankName,
            bankAccountNumber: row.bankAccountNumber,
            ifscCode: row.ifscCode,
            baseSalary: row.baseSalary,
            hra: row.hra,
            specialAllowance: row.specialAllowance,
            internetAllowance: row.internetAllowance,
            performanceBonus: row.performanceBonus,
            ctc: row.ctc,
          },
        });
        updated++;
      } else {
        await prisma.user.create({
          data: {
            employeeId: row.employeeId,
            email: row.email,
            password: hashedPassword,
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone,
            role: orgRole.accessLevel,
            orgRoleId: orgRole.id,
            employmentType: row.employmentType,
            departmentId: row.departmentId,
            designationId: row.designationId,
            managerId: row.managerId,
            joiningDate: row.joiningDate,
            status: row.status,
            pan: row.pan,
            aadhaarNumber: row.aadhaarNumber,
            bankName: row.bankName,
            bankAccountNumber: row.bankAccountNumber,
            ifscCode: row.ifscCode,
            baseSalary: row.baseSalary,
            hra: row.hra,
            specialAllowance: row.specialAllowance,
            internetAllowance: row.internetAllowance,
            performanceBonus: row.performanceBonus,
            ctc: row.ctc,
            mustChangePassword: true,
          },
        });
        created++;
      }
    }

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entity: "User",
      details: `Bulk imported employees via Excel (${created} created, ${updated} updated)`,
    });

    return NextResponse.json({
      success: true,
      created,
      updated,
    });
  } catch (err) {
    console.error("Employee bulk import error:", err);
    return apiError("Failed to import employees", 500);
  }
}
