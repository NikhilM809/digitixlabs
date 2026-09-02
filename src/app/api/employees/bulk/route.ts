import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, createAuditLog } from "@/lib/api-utils";
import { canExportEmployees, canBulkImportEmployees } from "@/lib/permissions";
import {
  buildExcelBuffer,
  getRowValue,
  getRowDateValue,
  hasRowValue,
  parseExcelBuffer,
  parseOptionalNumber,
} from "@/lib/excel-utils";
import type { EmploymentType, Prisma, UserStatus } from "@prisma/client";

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
  isUpdate: boolean;
  userId?: string;
  changedFields: string[];
  data: Prisma.UserUpdateInput;
}

function parseOptionalRowNumber(
  row: Record<string, string | number | boolean | null | undefined>,
  label: string,
  ...keys: string[]
): { value?: number; error?: string } {
  if (!hasRowValue(row, ...keys)) return {};
  const raw = getRowValue(row, ...keys);
  const num = parseOptionalNumber(raw);
  if (num === null) {
    return { error: `Invalid ${label}` };
  }
  return { value: num };
}

function buildPartialUpdate(
  row: Record<string, string | number | boolean | null | undefined>,
  maps: {
    deptMap: Map<string, string>;
    desigMap: Map<string, string>;
    roleMap: Map<string, string>;
    empById: Map<string, { id: string; employeeId: string; email: string }>;
  }
): { data: Prisma.UserUpdateInput; changedFields: string[]; errors: string[] } {
  const data: Prisma.UserUpdateInput = {};
  const changedFields: string[] = [];
  const errors: string[] = [];

  const assign = <K extends keyof Prisma.UserUpdateInput>(
    field: K,
    label: string,
    value: Prisma.UserUpdateInput[K]
  ) => {
    data[field] = value;
    changedFields.push(label);
  };

  if (hasRowValue(row, "First Name", "first_name", "firstName")) {
    assign("firstName", "First Name", getRowValue(row, "First Name", "first_name", "firstName"));
  }
  if (hasRowValue(row, "Last Name", "last_name", "lastName")) {
    assign("lastName", "Last Name", getRowValue(row, "Last Name", "last_name", "lastName"));
  }
  if (hasRowValue(row, "Email", "email")) {
    assign("email", "Email", getRowValue(row, "Email", "email").toLowerCase());
  }
  if (hasRowValue(row, "Phone", "phone")) {
    assign("phone", "Phone", getRowValue(row, "Phone", "phone"));
  }

  if (hasRowValue(row, "Role Code", "role_code", "roleCode")) {
    const roleCode = getRowValue(row, "Role Code", "role_code", "roleCode");
    const orgRoleId = maps.roleMap.get(roleCode.toUpperCase());
    if (!orgRoleId) {
      errors.push(`Unknown role code ${roleCode}`);
    } else {
      changedFields.push("Role Code");
      data.orgRole = { connect: { id: orgRoleId } };
    }
  }

  if (hasRowValue(row, "Employment Type", "employment_type", "employmentType")) {
    const employmentType = getRowValue(
      row,
      "Employment Type",
      "employment_type",
      "employmentType"
    ) as EmploymentType;
    if (!["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"].includes(employmentType)) {
      errors.push("Invalid employment type");
    } else {
      assign("employmentType", "Employment Type", employmentType);
    }
  }

  if (hasRowValue(row, "Status", "status")) {
    const status = getRowValue(row, "Status", "status") as UserStatus;
    if (!["ACTIVE", "LEFT", "TERMINATED"].includes(status)) {
      errors.push("Invalid status");
    } else {
      assign("status", "Status", status);
    }
  }

  if (hasRowValue(row, "Joining Date", "joining_date", "joiningDate")) {
    const joiningDate = getRowDateValue(row, "Joining Date", "joining_date", "joiningDate");
    if (!joiningDate) {
      errors.push(
        "Invalid joining date (use YYYY-MM-DD, DD/MM/YYYY, or a valid Excel date cell)"
      );
    } else {
      assign("joiningDate", "Joining Date", joiningDate);
    }
  }

  if (hasRowValue(row, "Department", "department")) {
    const deptName = getRowValue(row, "Department", "department");
    const departmentId = maps.deptMap.get(deptName.toLowerCase()) ?? null;
    changedFields.push("Department");
    data.department = departmentId
      ? { connect: { id: departmentId } }
      : { disconnect: true };
  }

  if (hasRowValue(row, "Designation", "designation")) {
    const desigName = getRowValue(row, "Designation", "designation");
    const designationId = maps.desigMap.get(desigName.toLowerCase()) ?? null;
    changedFields.push("Designation");
    data.designation = designationId
      ? { connect: { id: designationId } }
      : { disconnect: true };
  }

  if (hasRowValue(row, "Manager Employee ID", "manager_employee_id", "managerEmployeeId")) {
    const managerEmployeeId = getRowValue(
      row,
      "Manager Employee ID",
      "manager_employee_id",
      "managerEmployeeId"
    );
    if (!managerEmployeeId || managerEmployeeId === "0") {
      changedFields.push("Manager Employee ID");
      data.manager = { disconnect: true };
    } else {
      const manager = maps.empById.get(managerEmployeeId.toUpperCase());
      if (!manager) {
        errors.push(`Manager Employee ID ${managerEmployeeId} not found`);
      } else {
        changedFields.push("Manager Employee ID");
        data.manager = { connect: { id: manager.id } };
      }
    }
  }

  if (hasRowValue(row, "PAN", "pan")) {
    assign("pan", "PAN", getRowValue(row, "PAN", "pan") || null);
  }
  if (hasRowValue(row, "Aadhaar", "aadhaar")) {
    assign("aadhaarNumber", "Aadhaar", getRowValue(row, "Aadhaar", "aadhaar") || null);
  }
  if (hasRowValue(row, "Bank Name", "bank_name", "bankName")) {
    assign("bankName", "Bank Name", getRowValue(row, "Bank Name", "bank_name", "bankName") || null);
  }
  if (hasRowValue(row, "Bank Account", "bank_account", "bankAccountNumber")) {
    assign(
      "bankAccountNumber",
      "Bank Account",
      getRowValue(row, "Bank Account", "bank_account", "bankAccountNumber") || null
    );
  }
  if (hasRowValue(row, "IFSC", "ifsc")) {
    assign("ifscCode", "IFSC", getRowValue(row, "IFSC", "ifsc")?.toUpperCase() || null);
  }

  const numericFields: Array<[string, keyof Prisma.UserUpdateInput, ...string[]]> = [
    ["Base Salary", "baseSalary", "Base Salary", "base_salary"],
    ["HRA", "hra", "HRA", "hra"],
    ["Special Allowance", "specialAllowance", "Special Allowance", "special_allowance", "specialAllowance"],
    ["Internet Allowance", "internetAllowance", "Internet Allowance", "internet_allowance", "internetAllowance"],
    ["Performance Bonus", "performanceBonus", "Performance Bonus", "performance_bonus", "performanceBonus"],
    ["CTC", "ctc", "CTC", "ctc"],
  ];

  for (const [label, field, ...keys] of numericFields) {
    const parsed = parseOptionalRowNumber(row, label, ...keys);
    if (parsed.error) {
      errors.push(parsed.error);
    } else if (parsed.value !== undefined) {
      assign(field, label, parsed.value);
    }
  }

  // Legacy column names map to new salary fields when updating
  if (hasRowValue(row, "Incentive", "incentive") && !hasRowValue(row, "Special Allowance", "special_allowance", "specialAllowance")) {
    const parsed = parseOptionalRowNumber(row, "Incentive", "Incentive", "incentive");
    if (parsed.error) errors.push(parsed.error);
    else if (parsed.value !== undefined) assign("specialAllowance", "Incentive", parsed.value);
  }
  if (hasRowValue(row, "Reimbursement", "reimbursement") && !hasRowValue(row, "Internet Allowance", "internet_allowance", "internetAllowance")) {
    const parsed = parseOptionalRowNumber(row, "Reimbursement", "Reimbursement", "reimbursement");
    if (parsed.error) errors.push(parsed.error);
    else if (parsed.value !== undefined) assign("internetAllowance", "Reimbursement", parsed.value);
  }

  return { data, changedFields, errors };
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

    const [departments, designations, roles, employees] = await Promise.all([
      prisma.department.findMany({ select: { id: true, name: true } }),
      prisma.designation.findMany({ select: { id: true, name: true } }),
      prisma.employeeRoleDefinition.findMany({
        where: { isActive: true },
        select: { id: true, code: true, accessLevel: true },
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
    const roleAccessMap = new Map(roles.map((r) => [r.id, r.accessLevel]));
    const empById = new Map(employees.map((e) => [e.employeeId.toUpperCase(), e]));
    const empByEmail = new Map(employees.map((e) => [e.email.toLowerCase(), e]));

    const maps = { deptMap, desigMap, roleMap, empById };

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

      const idKey = employeeId.toUpperCase();
      if (seenIds.has(idKey)) {
        errors.push({ row: rowNum, message: `Duplicate Employee ID ${employeeId}` });
        return;
      }
      seenIds.add(idKey);

      const existingById = empById.get(idKey);

      if (existingById) {
        const { data, changedFields, errors: rowErrors } = buildPartialUpdate(row, maps);

        for (const message of rowErrors) {
          errors.push({ row: rowNum, message });
        }
        if (rowErrors.length > 0) return;

        if (changedFields.length === 0) {
          errors.push({
            row: rowNum,
            message:
              "No fields to update. Include at least one column besides Employee ID.",
          });
          return;
        }

        if (typeof data.email === "string") {
          const patchEmail = data.email.toLowerCase();
          const existingByEmail = empByEmail.get(patchEmail);
          if (existingByEmail && existingByEmail.id !== existingById.id) {
            errors.push({ row: rowNum, message: "Email already used by another employee" });
            return;
          }
        }

        validRows.push({
          employeeId,
          isUpdate: true,
          userId: existingById.id,
          changedFields,
          data,
        });
        return;
      }

      // Create new employee — require core fields
      if (!firstName || !lastName) {
        errors.push({ row: rowNum, message: "First name and last name are required for new employees" });
        return;
      }
      if (!email) {
        errors.push({ row: rowNum, message: "Email is required for new employees" });
        return;
      }
      if (empByEmail.has(email)) {
        errors.push({ row: rowNum, message: "Email already used by another employee" });
        return;
      }

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

      const joiningDate = getRowDateValue(row, "Joining Date", "joining_date", "joiningDate");
      if (!joiningDate) {
        errors.push({
          row: rowNum,
          message:
            "Joining date is required for new employees (YYYY-MM-DD, DD/MM/YYYY, or Excel date)",
        });
        return;
      }

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

      const deptName = getRowValue(row, "Department", "department");
      const desigName = getRowValue(row, "Designation", "designation");
      const departmentId = deptName ? deptMap.get(deptName.toLowerCase()) ?? null : null;
      const designationId = desigName ? desigMap.get(desigName.toLowerCase()) ?? null : null;

      const baseSalaryResult = parseOptionalRowNumber(row, "Base Salary", "Base Salary", "base_salary");
      const hraResult = parseOptionalRowNumber(row, "HRA", "HRA", "hra");
      const specialAllowanceResult = parseOptionalRowNumber(
        row,
        "Special Allowance",
        "Special Allowance",
        "special_allowance",
        "specialAllowance"
      );
      const incentiveResult = parseOptionalRowNumber(row, "Incentive", "Incentive", "incentive");
      const internetAllowanceResult = parseOptionalRowNumber(
        row,
        "Internet Allowance",
        "Internet Allowance",
        "internet_allowance",
        "internetAllowance"
      );
      const reimbursementResult = parseOptionalRowNumber(
        row,
        "Reimbursement",
        "Reimbursement",
        "reimbursement"
      );
      const performanceBonusResult = parseOptionalRowNumber(
        row,
        "Performance Bonus",
        "Performance Bonus",
        "performance_bonus",
        "performanceBonus"
      );
      const ctcResult = parseOptionalRowNumber(row, "CTC", "CTC", "ctc");

      for (const result of [
        baseSalaryResult,
        hraResult,
        specialAllowanceResult,
        incentiveResult,
        internetAllowanceResult,
        reimbursementResult,
        performanceBonusResult,
        ctcResult,
      ]) {
        if (result.error) {
          errors.push({ row: rowNum, message: result.error });
          return;
        }
      }

      const baseSalary = baseSalaryResult.value ?? 0;
      const hra = hraResult.value ?? 0;
      const specialAllowance =
        specialAllowanceResult.value ?? incentiveResult.value ?? 0;
      const internetAllowance =
        internetAllowanceResult.value ?? reimbursementResult.value ?? 0;
      const performanceBonus = performanceBonusResult.value ?? 0;
      const ctc = ctcResult.value ?? 0;

      validRows.push({
        employeeId,
        isUpdate: false,
        changedFields: ["new employee"],
        data: {
          employeeId,
          email,
          firstName,
          lastName,
          phone: getRowValue(row, "Phone", "phone") || null,
          role: roleAccessMap.get(orgRoleId)!,
          orgRole: { connect: { id: orgRoleId } },
          employmentType,
          department: departmentId ? { connect: { id: departmentId } } : undefined,
          designation: designationId ? { connect: { id: designationId } } : undefined,
          manager: managerId ? { connect: { id: managerId } } : undefined,
          joiningDate,
          status,
          pan: getRowValue(row, "PAN", "pan") || null,
          aadhaarNumber: getRowValue(row, "Aadhaar", "aadhaar") || null,
          bankName: getRowValue(row, "Bank Name", "bank_name", "bankName") || null,
          bankAccountNumber:
            getRowValue(row, "Bank Account", "bank_account", "bankAccountNumber") || null,
          ifscCode: getRowValue(row, "IFSC", "ifsc")?.toUpperCase() || null,
          baseSalary,
          hra,
          specialAllowance,
          internetAllowance,
          performanceBonus,
          ctc,
        },
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
          action: r.isUpdate ? "update" : "create",
          fields: r.changedFields,
        })),
        message: "Validation passed. Set confirm=true to apply changes.",
      });
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    let created = 0;
    let updated = 0;

    for (const row of validRows) {
      if (row.isUpdate && row.userId) {
        const updateData = { ...row.data };
        if (updateData.orgRole && "connect" in updateData.orgRole && updateData.orgRole.connect?.id) {
          const orgRoleId = updateData.orgRole.connect.id;
          const accessLevel = roleAccessMap.get(orgRoleId);
          if (accessLevel) {
            updateData.role = accessLevel;
          }
        }
        await prisma.user.update({
          where: { id: row.userId },
          data: updateData,
        });
        updated++;
      } else {
        await prisma.user.create({
          data: {
            ...(row.data as Prisma.UserCreateInput),
            password: hashedPassword,
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
      message: `Import complete (${created} created, ${updated} updated)`,
    });
  } catch (err) {
    console.error("Employee bulk import error:", err);
    return apiError("Failed to import employees", 500);
  }
}
