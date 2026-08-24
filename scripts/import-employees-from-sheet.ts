/**
 * Import employees from the Digitix spreadsheet.
 *
 * Usage:
 *   npm run db:import-employees
 *   npm run db:import-employees -- --no-clear   # keep existing users, upsert only
 *
 * By default clears all users except admin@digitixlabs.com, then imports the full list.
 * Missing fields are stored as "0".
 */
import "./load-env";
import { requireDatabaseUrl } from "./load-env";

requireDatabaseUrl();

import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { ensureEmployeeRoles } from "../src/lib/employee-roles";
import type { EmploymentType, UserStatus } from "@prisma/client";

interface EmployeeRow {
  employeeId: string;
  name?: string;
  pan?: string;
  bankName?: string;
  accountNumber?: string;
  department: "Survey Programing" | "Vendor";
  ifscCode?: string;
  status?: UserStatus;
  employmentType?: EmploymentType;
}

const ZERO = "0";

const EMPLOYEE_ROWS: EmployeeRow[] = [
  {
    employeeId: "DXL00001",
    name: "Neha Agarwal",
    pan: "CWJPA3189F",
    bankName: "Federal Bank",
    accountNumber: "22360100000000",
    department: "Survey Programing",
    ifscCode: "FDRL0002236",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00002",
    name: "Sabhya Patel",
    pan: "CXJPP0512Q",
    bankName: "SBI",
    accountNumber: "40464353085",
    department: "Survey Programing",
    ifscCode: "SBIN0017815",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00003",
    name: "Nidhi",
    pan: "ANPPN2247L",
    bankName: "HDFC",
    accountNumber: "50100500000000",
    department: "Survey Programing",
    ifscCode: "HDFC0000088",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00004",
    name: "Anita",
    pan: "AKDPA1637Q",
    bankName: "Federal Bank",
    accountNumber: "22360100000000",
    department: "Survey Programing",
    ifscCode: "FDRL0002236",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00005",
    name: "Angoori Niranjan",
    pan: "BKUPN9250N",
    bankName: "SBI",
    accountNumber: "10930661481",
    department: "Survey Programing",
    ifscCode: "SBIN0004542",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00006",
    name: "Jyoti Maurya",
    pan: "EYLPM6243L",
    bankName: "Axis",
    accountNumber: "925010000000000",
    department: "Survey Programing",
    ifscCode: "UTIB0003475",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00007",
    department: "Survey Programing",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00008",
    name: "Yashvi",
    pan: "BHFPY5638F",
    bankName: "Kotak Mahindra",
    accountNumber: "7550186697",
    department: "Survey Programing",
    ifscCode: "KKBK0004674",
    status: "TERMINATED",
  },
  {
    employeeId: "DXL00009",
    name: "Shivank Saini",
    pan: "FLNPS9115P",
    bankName: "Yes Bank",
    accountNumber: "48391600000000",
    department: "Survey Programing",
    ifscCode: "YESB0000483",
    status: "TERMINATED",
  },
  {
    employeeId: "DXL00010",
    name: "Mehek Jain",
    pan: "CZYPJ2199G",
    bankName: "Union Bank, Civil Township",
    accountNumber: "134912000000000",
    department: "Survey Programing",
    ifscCode: "UBIN0813494",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00011",
    name: "Prachi Verma",
    pan: "CETPV8274C",
    bankName: "SBI, JanakPuri",
    accountNumber: "41124730827",
    department: "Survey Programing",
    ifscCode: "SBIN0004208",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00012",
    name: "Akhil Pratap Singh",
    pan: "LEFPS4917C",
    bankName: "Bank of Baroda",
    accountNumber: "19240100000000",
    department: "Survey Programing",
    ifscCode: "BARB0DARRAE",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00013",
    name: "NAMAN GOENKA",
    pan: "DNIPG6426C",
    bankName: "INDUSIND BANK",
    accountNumber: "160000000000",
    department: "Survey Programing",
    ifscCode: "INDB0000145",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00014",
    name: "Deependra Singh Niranjan",
    pan: "CLRPN0413N",
    bankName: "IDFC",
    accountNumber: "10219499916",
    department: "Survey Programing",
    ifscCode: "IDFB0043416",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00015",
    name: "Lovekush Yadav",
    pan: "EMPPK0829A",
    bankName: "SBI",
    accountNumber: "20357661342",
    department: "Survey Programing",
    ifscCode: "SBIN0011311",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00016",
    name: "Harsh Tiwari",
    pan: "BORPT2826K",
    bankName: "UCO Bank",
    accountNumber: "17450100000000",
    department: "Survey Programing",
    ifscCode: "UCBA0001745",
    status: "TERMINATED",
  },
  {
    employeeId: "DXL00017",
    name: "Sneha chaudhary",
    pan: "DHSPC6539L",
    bankName: "Canara bank",
    accountNumber: "110223000000",
    department: "Survey Programing",
    ifscCode: "CNRB0018899",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00018",
    name: "Mukesh Tomer",
    pan: "AFMPT2266G",
    bankName: "Punjab National Bank",
    accountNumber: "6798000000000000",
    department: "Survey Programing",
    ifscCode: "PUNB0679800",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00019",
    name: "Srinivasan Iyer",
    department: "Survey Programing",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00020",
    name: "Adarsh Choubey",
    department: "Survey Programing",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00021",
    name: "Bethina Ramachandramurthy",
    department: "Survey Programing",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00022",
    name: "PURINI HARSHA CHANDRA YOGA",
    department: "Survey Programing",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00023",
    name: "Shoshal Yadav",
    department: "Survey Programing",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00024",
    department: "Survey Programing",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00025",
    department: "Survey Programing",
    status: "ACTIVE",
  },
  {
    employeeId: "DXL00026",
    department: "Survey Programing",
    status: "ACTIVE",
  },
  {
    employeeId: "DXLV0001",
    name: "Sushama Kumari (Deepak)",
    pan: "JSGPK9272P",
    bankName: "IDFC",
    accountNumber: "10102087223",
    department: "Vendor",
    ifscCode: "IDFB0020134",
    status: "ACTIVE",
    employmentType: "CONTRACT",
  },
  {
    employeeId: "DXLV0002",
    name: "GARIMA ADHIKARI",
    pan: "BVCPA6769A",
    bankName: "SBI",
    accountNumber: "33857380549",
    department: "Vendor",
    ifscCode: "SBIN0015152",
    status: "ACTIVE",
    employmentType: "CONTRACT",
  },
  {
    employeeId: "DXLV0003",
    name: "Rajendra Prasad Baunthiyal",
    pan: "AGAPB6188J",
    bankName: "Uttarakhand Gramin Bank",
    accountNumber: "4221005555",
    department: "Vendor",
    ifscCode: "SBIN0RRUTGB",
    status: "ACTIVE",
    employmentType: "CONTRACT",
  },
  {
    employeeId: "DXLV0004",
    name: "Veena Bathla",
    pan: "CXQPB4834E",
    bankName: "State of India, Jansath",
    accountNumber: "20325872191",
    department: "Vendor",
    ifscCode: "SBIN0001028",
    status: "ACTIVE",
    employmentType: "CONTRACT",
  },
  {
    employeeId: "DXLV0005",
    name: "Chabi Agarwal",
    pan: "AGVPA3347B",
    bankName: "State of India, Kavi Nagar Ghaziabad",
    accountNumber: "10149943667",
    department: "Vendor",
    ifscCode: "SBIN0003279",
    status: "ACTIVE",
    employmentType: "CONTRACT",
  },
];

function val(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : ZERO;
}

function parseName(fullName: string) {
  if (fullName === ZERO) {
    return { firstName: ZERO, lastName: ZERO };
  }
  const cleaned = fullName.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: ZERO, lastName: ZERO };
  }
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || ZERO;
  return { firstName, lastName };
}

function emailFromEmployeeId(employeeId: string) {
  const local = employeeId.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${local}@digitixlabs.com`;
}

async function clearEmployeeDatabase(adminId: string) {
  const usersToRemove = await prisma.user.findMany({
    where: { id: { not: adminId } },
    select: { id: true, email: true },
  });

  if (usersToRemove.length === 0) {
    console.log("No employees to remove.");
    return 0;
  }

  const ids = usersToRemove.map((u) => u.id);

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { managerId: { in: ids } },
      data: { managerId: null },
    });

    await tx.leaveRequest.updateMany({
      where: { approvedById: { in: ids } },
      data: { approvedById: null },
    });

    await tx.kraReview.updateMany({
      where: { managerId: { in: ids } },
      data: { managerId: null },
    });

    await tx.reportingHistory.updateMany({
      where: { managerId: { in: ids } },
      data: { managerId: null },
    });

    await tx.reportingHistory.updateMany({
      where: { changedById: { in: ids } },
      data: { changedById: null },
    });

    await tx.employeeDocument.deleteMany({
      where: {
        OR: [{ userId: { in: ids } }, { uploadedById: { in: ids } }],
      },
    });

    await tx.employeeKra.updateMany({
      where: { createdById: { in: ids } },
      data: { createdById: null },
    });

    await tx.employeeKra.updateMany({
      where: { updatedById: { in: ids } },
      data: { updatedById: null },
    });

    await tx.employeeKraConfig.updateMany({
      where: { finalizedById: { in: ids } },
      data: { finalizedById: null },
    });

    const deleted = await tx.user.deleteMany({
      where: { id: { in: ids } },
    });

    console.log(
      `Removed ${deleted.count} users (kept admin). Emails removed: ${usersToRemove.map((u) => u.email).join(", ")}`
    );
  });

  return usersToRemove.length;
}

async function main() {
  const shouldClear = !process.argv.includes("--no-clear");

  await ensureEmployeeRoles();

  const admin = await prisma.user.findUnique({
    where: { email: "admin@digitixlabs.com" },
  });
  if (!admin) {
    throw new Error("admin@digitixlabs.com not found. Run npm run db:seed first.");
  }

  const surveyDept = await prisma.department.upsert({
    where: { name: "Survey Programing" },
    update: { isActive: true },
    create: { name: "Survey Programing", description: "Survey Programming team" },
  });

  const vendorDept = await prisma.department.upsert({
    where: { name: "Vendor" },
    update: { isActive: true },
    create: { name: "Vendor", description: "Vendor / contract resources" },
  });

  const employeeRole = await prisma.employeeRoleDefinition.findUnique({
    where: { code: "EMPLOYEE" },
  });
  if (!employeeRole) {
    throw new Error("Employee role definition not found. Run npm run db:seed first.");
  }

  if (shouldClear) {
    console.log("Clearing employee database (keeping admin)...");
    await clearEmployeeDatabase(admin.id);
  } else {
    console.log("Skipping clear (--no-clear). Upserting employees only.");
  }

  const defaultPassword = await bcrypt.hash("Digitix@123", 12);
  let created = 0;
  let updated = 0;

  for (const row of EMPLOYEE_ROWS) {
    const name = val(row.name);
    const { firstName, lastName } = parseName(name);
    const email = emailFromEmployeeId(row.employeeId);
    const departmentId = row.department === "Vendor" ? vendorDept.id : surveyDept.id;

    const data = {
      email,
      firstName,
      lastName,
      pan: val(row.pan).toUpperCase(),
      aadhaarNumber: ZERO,
      bankName: val(row.bankName),
      bankAccountNumber: val(row.accountNumber),
      ifscCode: val(row.ifscCode).toUpperCase(),
      departmentId,
      status: row.status ?? "ACTIVE",
      employmentType: row.employmentType ?? "FULL_TIME",
      role: "EMPLOYEE" as const,
      orgRoleId: employeeRole.id,
    };

    const existing = await prisma.user.findUnique({
      where: { employeeId: row.employeeId },
    });

    if (existing) {
      await prisma.user.update({
        where: { employeeId: row.employeeId },
        data,
      });
      updated++;
    } else {
      await prisma.user.create({
        data: {
          employeeId: row.employeeId,
          password: defaultPassword,
          mustChangePassword: true,
          joiningDate: new Date(),
          ...data,
        },
      });
      created++;
    }
  }

  const total = await prisma.user.count();
  console.log(`Import complete: ${created} created, ${updated} updated.`);
  console.log(`Total users in database now: ${total}`);
  console.log(`Expected imported rows: ${EMPLOYEE_ROWS.length}`);
  console.log("Default password for new employees: Digitix@123");
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
