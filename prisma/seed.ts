import "../scripts/load-env";
import { requireDatabaseUrl } from "../scripts/load-env";

requireDatabaseUrl();

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { ensureEmployeeRoles } from "../src/lib/employee-roles";
import { DEFAULT_COMPANY_POLICIES } from "../src/lib/default-company-policies";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Digitix HRMS database...");

  await ensureEmployeeRoles();

  // Company Settings
  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "DigitixLabs",
      companyLogo: "/digitix-logo.png",
      companyEmail: "info@digitixlabs.com",
      companyTan: "DELD12345A",
      leavePolicy: "Employees are entitled to annual, casual, and sick leave as per company policy. Leave requests must be submitted at least 2 days in advance except for emergencies.",
      attendanceRules: "Standard work hours: 9:00 AM - 6:00 PM. Late arrival beyond 15 minutes is marked as late. Minimum 8 hours required for full day attendance.",
      passwordPolicy: "Passwords must be at least 8 characters with uppercase, lowercase, and numbers. Change every 90 days.",
      sessionTimeout: 30,
      workStartTime: "09:00",
      workEndTime: "18:00",
      lateThreshold: 15,
    },
  });

  // Departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { name: "Engineering" },
      update: {},
      create: { name: "Engineering", description: "Software Development & IT" },
    }),
    prisma.department.upsert({
      where: { name: "Human Resources" },
      update: {},
      create: { name: "Human Resources", description: "HR & People Operations" },
    }),
    prisma.department.upsert({
      where: { name: "Data Analytics" },
      update: {},
      create: { name: "Data Analytics", description: "Business Intelligence & Analytics" },
    }),
    prisma.department.upsert({
      where: { name: "Operations" },
      update: {},
      create: { name: "Operations", description: "Business Operations & Support" },
    }),
    prisma.department.upsert({
      where: { name: "Sales & Marketing" },
      update: {},
      create: { name: "Sales & Marketing", description: "Sales, Marketing & Client Relations" },
    }),
  ]);

  // Designations
  const designations = await Promise.all([
    prisma.designation.upsert({
      where: { name: "Chief Executive Officer" },
      update: {},
      create: { name: "Chief Executive Officer", description: "CEO" },
    }),
    prisma.designation.upsert({
      where: { name: "Engineering Manager" },
      update: {},
      create: { name: "Engineering Manager", description: "Engineering Team Lead" },
    }),
    prisma.designation.upsert({
      where: { name: "Senior Software Engineer" },
      update: {},
      create: { name: "Senior Software Engineer" },
    }),
    prisma.designation.upsert({
      where: { name: "Software Engineer" },
      update: {},
      create: { name: "Software Engineer" },
    }),
    prisma.designation.upsert({
      where: { name: "Data Analyst" },
      update: {},
      create: { name: "Data Analyst" },
    }),
    prisma.designation.upsert({
      where: { name: "HR Manager" },
      update: {},
      create: { name: "HR Manager" },
    }),
    prisma.designation.upsert({
      where: { name: "HR Executive" },
      update: {},
      create: { name: "HR Executive" },
    }),
    prisma.designation.upsert({
      where: { name: "Chief Technology Officer" },
      update: {},
      create: { name: "Chief Technology Officer", description: "CTO" },
    }),
    prisma.designation.upsert({
      where: { name: "Delivery Manager" },
      update: {},
      create: { name: "Delivery Manager", description: "Delivery and execution lead" },
    }),
    prisma.designation.upsert({
      where: { name: "Project Manager" },
      update: {},
      create: { name: "Project Manager", description: "Project delivery manager" },
    }),
    prisma.designation.upsert({
      where: { name: "Team Lead" },
      update: {},
      create: { name: "Team Lead", description: "Functional team lead" },
    }),
    prisma.designation.upsert({
      where: { name: "QA Engineer" },
      update: {},
      create: { name: "QA Engineer" },
    }),
    prisma.designation.upsert({
      where: { name: "DevOps Engineer" },
      update: {},
      create: { name: "DevOps Engineer" },
    }),
    prisma.designation.upsert({
      where: { name: "Business Analyst" },
      update: {},
      create: { name: "Business Analyst" },
    }),
    prisma.designation.upsert({
      where: { name: "UI/UX Designer" },
      update: {},
      create: { name: "UI/UX Designer" },
    }),
    prisma.designation.upsert({
      where: { name: "Technical Architect" },
      update: {},
      create: { name: "Technical Architect" },
    }),
  ]);

  // Leave Types
  const leaveTypes = await Promise.all([
    prisma.leaveType.upsert({
      where: { code: "CL" },
      update: {},
      create: { name: "Casual Leave", code: "CL", defaultDays: 12, description: "Casual leave for personal matters" },
    }),
    prisma.leaveType.upsert({
      where: { code: "SL" },
      update: {},
      create: { name: "Sick Leave", code: "SL", defaultDays: 10, requiresAttachment: true, description: "Medical leave" },
    }),
    prisma.leaveType.upsert({
      where: { code: "AL" },
      update: {},
      create: { name: "Annual Leave", code: "AL", defaultDays: 20, description: "Annual vacation leave" },
    }),
    prisma.leaveType.upsert({
      where: { code: "FL" },
      update: { isActive: true, name: "Floater Leave" },
      create: {
        name: "Floater Leave",
        code: "FL",
        defaultDays: 2,
        description: "Optional floater leave for special occasions",
      },
    }),
    prisma.leaveType.upsert({
      where: { code: "WFH" },
      update: { isActive: false },
      create: { name: "Work From Home", code: "WFH", defaultDays: 24, description: "Remote work days", isActive: false },
    }),
    prisma.leaveType.upsert({
      where: { code: "HD" },
      update: { isActive: false },
      create: { name: "Half Day", code: "HD", defaultDays: 0, description: "Half day leave", isActive: false },
    }),
    prisma.leaveType.upsert({
      where: { code: "ML" },
      update: { isActive: false },
      create: { name: "Maternity Leave", code: "ML", defaultDays: 180, description: "Maternity leave", isActive: false },
    }),
    prisma.leaveType.upsert({
      where: { code: "PL" },
      update: { isActive: false },
      create: { name: "Paternity Leave", code: "PL", defaultDays: 15, description: "Paternity leave", isActive: false },
    }),
    prisma.leaveType.upsert({
      where: { code: "PRL" },
      update: {},
      create: {
        name: "Maternity/Parental Leave",
        code: "PRL",
        defaultDays: 0,
        description: "Parental leave (maternity/paternity). Days are assigned per employee as required.",
      },
    }),
    prisma.leaveType.upsert({
      where: { code: "UL" },
      update: {},
      create: { name: "Unpaid Leave", code: "UL", defaultDays: 0, isPaid: false, description: "Unpaid leave" },
    }),
  ]);

  const hashedPassword = await bcrypt.hash("Admin@123", 12);
  const employeePassword = await bcrypt.hash("Welcome@123", 12);
  const currentYear = new Date().getFullYear();

  // Admin User
  const admin = await prisma.user.upsert({
    where: { email: "admin@digitixlabs.com" },
    update: {
      status: "ACTIVE",
      role: "ADMIN",
    },
    create: {
      employeeId: "DXL0001",
      email: "admin@digitixlabs.com",
      password: hashedPassword,
      firstName: "System",
      lastName: "Admin",
      phone: "+91-9717889049",
      role: "ADMIN",
      employmentType: "FULL_TIME",
      departmentId: departments[1].id,
      designationId: designations[5].id,
      joiningDate: new Date("2020-01-15"),
      dateOfBirth: new Date("1985-06-15"),
    },
  });

  // Manager
  const manager = await prisma.user.upsert({
    where: { email: "manager@digitixlabs.com" },
    update: {},
    create: {
      employeeId: "DXL0002",
      email: "manager@digitixlabs.com",
      password: employeePassword,
      firstName: "Rajesh",
      lastName: "Kumar",
      phone: "+91-9876543210",
      role: "MANAGER",
      employmentType: "FULL_TIME",
      departmentId: departments[0].id,
      designationId: designations[1].id,
      joiningDate: new Date("2021-03-01"),
      dateOfBirth: new Date("1988-09-22"),
    },
  });

  // HR User
  const hrUser = await prisma.user.upsert({
    where: { email: "hr@digitixlabs.com" },
    update: {},
    create: {
      employeeId: "DXL0005",
      email: "hr@digitixlabs.com",
      password: employeePassword,
      firstName: "Anita",
      lastName: "Verma",
      phone: "+91-9876543215",
      role: "HR",
      employmentType: "FULL_TIME",
      departmentId: departments[1].id,
      designationId: designations[6].id,
      joiningDate: new Date("2021-08-01"),
      dateOfBirth: new Date("1990-04-18"),
    },
  });

  // Employees
  const employees = await Promise.all([
    prisma.user.upsert({
      where: { email: "priya.sharma@digitixlabs.com" },
      update: {},
      create: {
        employeeId: "DXL0003",
        email: "priya.sharma@digitixlabs.com",
        password: employeePassword,
        firstName: "Priya",
        lastName: "Sharma",
        phone: "+91-9876543211",
        role: "EMPLOYEE",
        departmentId: departments[0].id,
        designationId: designations[2].id,
        managerId: manager.id,
        joiningDate: new Date("2022-06-15"),
        dateOfBirth: new Date("1992-03-10"),
      },
    }),
    prisma.user.upsert({
      where: { email: "amit.patel@digitixlabs.com" },
      update: {},
      create: {
        employeeId: "DXL0004",
        email: "amit.patel@digitixlabs.com",
        password: employeePassword,
        firstName: "Amit",
        lastName: "Patel",
        phone: "+91-9876543212",
        role: "EMPLOYEE",
        departmentId: departments[0].id,
        designationId: designations[3].id,
        managerId: manager.id,
        joiningDate: new Date("2023-01-10"),
        dateOfBirth: new Date("1995-07-18"),
      },
    }),
    prisma.user.upsert({
      where: { email: "sneha.gupta@digitixlabs.com" },
      update: {},
      create: {
        employeeId: "DXL0007",
        email: "sneha.gupta@digitixlabs.com",
        password: employeePassword,
        firstName: "Sneha",
        lastName: "Gupta",
        phone: "+91-9876543213",
        role: "EMPLOYEE",
        departmentId: departments[2].id,
        designationId: designations[4].id,
        managerId: manager.id,
        joiningDate: new Date("2023-08-01"),
        dateOfBirth: new Date("1994-11-25"),
      },
    }),
    prisma.user.upsert({
      where: { email: "vikram.singh@digitixlabs.com" },
      update: {},
      create: {
        employeeId: "DXL0006",
        email: "vikram.singh@digitixlabs.com",
        password: employeePassword,
        firstName: "Vikram",
        lastName: "Singh",
        phone: "+91-9876543214",
        role: "EMPLOYEE",
        departmentId: departments[3].id,
        designationId: designations[6].id,
        managerId: manager.id,
        joiningDate: new Date("2024-02-14"),
        dateOfBirth: new Date("1996-01-30"),
      },
    }),
  ]);

  // Leave Balances for all users
  const allUsers = [admin, manager, hrUser, ...employees];
  for (const user of allUsers) {
    for (const leaveType of leaveTypes) {
      if (leaveType.defaultDays > 0) {
        await prisma.leaveBalance.upsert({
          where: {
            userId_leaveTypeId_year: {
              userId: user.id,
              leaveTypeId: leaveType.id,
              year: currentYear,
            },
          },
          update: {},
          create: {
            userId: user.id,
            leaveTypeId: leaveType.id,
            year: currentYear,
            totalDays: leaveType.defaultDays,
            usedDays: 0,
            pendingDays: 0,
          },
        });
      }
    }
  }

  // Sample Announcements
  await prisma.announcement.create({
    data: {
      title: "Welcome to Digitix HRMS",
      content: "We are excited to launch our new Employee Leave & Attendance Management System. Please update your profile and familiarize yourself with the new platform.",
      createdBy: admin.id,
    },
  }).catch(() => {});

  await prisma.announcement.create({
    data: {
      title: "Annual Performance Review Cycle",
      content: "The annual performance review cycle will begin next month. All employees are requested to complete their self-assessments by the end of the month.",
      createdBy: admin.id,
    },
  }).catch(() => {});

  // Sample Leave Requests
  await prisma.leaveRequest.create({
    data: {
      userId: employees[0].id,
      leaveTypeId: leaveTypes[0].id,
      fromDate: new Date("2026-08-15"),
      toDate: new Date("2026-08-16"),
      totalDays: 2,
      reason: "Family function requiring travel to hometown",
      status: "PENDING",
    },
  }).catch(() => {});

  // Sample Attendance (today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const user of [manager, ...employees]) {
    const checkIn = new Date();
    checkIn.setHours(9, Math.floor(Math.random() * 30), 0, 0);

    await prisma.attendance.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      update: {},
      create: {
        userId: user.id,
        date: today,
        checkIn,
        status: checkIn.getHours() > 9 || (checkIn.getHours() === 9 && checkIn.getMinutes() > 15) ? "LATE" : "PRESENT",
        isLate: checkIn.getHours() > 9 || (checkIn.getHours() === 9 && checkIn.getMinutes() > 15),
      },
    });
  }

  // Sample Payslips
  for (const user of allUsers) {
    const salary = user.role === "ADMIN" ? 150000 : user.role === "MANAGER" ? 120000 : 80000;
    const hra = salary * 0.4;
    const specialAllowance = user.role === "EMPLOYEE" ? 3000 : 5000;
    const internetAllowance = user.role === "EMPLOYEE" ? 2000 : 3000;
    const performanceBonus = user.role === "EMPLOYEE" ? 5000 : 10000;
    const deductions = salary * 0.1;
    const netSalary = salary + hra + specialAllowance + internetAllowance + performanceBonus - deductions;
    await prisma.payslip.upsert({
      where: { userId_month_year: { userId: user.id, month: 7, year: 2026 } },
      update: {},
      create: {
        userId: user.id,
        month: 7,
        year: 2026,
        salary,
        hra,
        specialAllowance,
        internetAllowance,
        performanceBonus,
        deductions,
        netSalary,
        uploadedBy: admin.id,
      },
    });
  }

  const priya = allUsers.find((u) => u.email === "priya.sharma@digitixlabs.com");
  if (priya) {
    const kraItems = [
      {
        name: "Email confirmation",
        measure:
          "Emails confirmed on time (Max 10-15 minutes delay can be acceptable on non-urgent request)",
        weight: 10,
        sortOrder: 1,
      },
      {
        name: "Delivery timeline meeting",
        measure: "Meeting the timeline committed",
        weight: 15,
        sortOrder: 2,
      },
      {
        name: "Internal Quality standards",
        measure: "Meeting minimum 98% quality criteria for each project undertaken",
        weight: 45,
        sortOrder: 3,
      },
      {
        name: "Live Issue / Escalation",
        measure: "No live issue reported by client DP/PM",
        weight: 20,
        sortOrder: 4,
      },
      {
        name: "Live Projects",
        measure: "Minimum 25 projects per quarter",
        weight: 10,
        sortOrder: 5,
      },
      {
        name: "Guiding Juniors and Problem solving internally",
        measure:
          "Guiding junior to meet client standard and internal Quality standards and Participate in internal problem solving",
        weight: null,
        sortOrder: 6,
      },
      {
        name: "Problem solving",
        measure: "Providing suggestions to client and resolve possible roadblocks if any.",
        weight: null,
        sortOrder: 7,
      },
    ];
    for (const item of kraItems) {
      await prisma.employeeKra.create({
        data: {
          userId: priya.id,
          name: item.name,
          measure: item.measure,
          weight: item.weight,
          sortOrder: item.sortOrder,
          createdById: admin.id,
          updatedById: admin.id,
        },
      });
    }
    await prisma.employeeKraConfig.upsert({
      where: { userId: priya.id },
      update: {
        isFinalized: true,
        finalizedAt: new Date(),
        finalizedById: admin.id,
        reviewCycle: "QUARTERLY",
        periodLabel: "Survey Programming and Operations (Quarterly - APR 2026)",
        remarks: "Overall 50% performance",
      },
      create: {
        userId: priya.id,
        isFinalized: true,
        finalizedAt: new Date(),
        finalizedById: admin.id,
        reviewCycle: "QUARTERLY",
        periodLabel: "Survey Programming and Operations (Quarterly - APR 2026)",
        remarks: "Overall 50% performance",
      },
    });
  }

  // Permissions
  const permissions = [
    { name: "employees.read", module: "employees", description: "View employees" },
    { name: "employees.write", module: "employees", description: "Manage employees" },
    { name: "leave.read", module: "leave", description: "View leave requests" },
    { name: "leave.approve", module: "leave", description: "Approve leave requests" },
    { name: "attendance.read", module: "attendance", description: "View attendance" },
    { name: "attendance.write", module: "attendance", description: "Manage attendance" },
    { name: "reports.read", module: "reports", description: "View reports" },
    { name: "reports.export", module: "reports", description: "Export reports" },
    { name: "settings.read", module: "settings", description: "View settings" },
    { name: "settings.write", module: "settings", description: "Manage settings" },
  ];

  for (const perm of permissions) {
    const permission = await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });

    for (const role of ["ADMIN", "HR"] as const) {
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: permission.id } },
        update: {},
        create: { role, permissionId: permission.id },
      }).catch(() => {});
    }
  }

  // Seed company policy handbook
  for (const policy of DEFAULT_COMPANY_POLICIES) {
    await prisma.companyPolicy.upsert({
      where: { id: policy.id },
      update: {
        title: policy.title,
        content: policy.content,
        sortOrder: policy.sortOrder,
        isActive: true,
      },
      create: {
        id: policy.id,
        title: policy.title,
        content: policy.content,
        sortOrder: policy.sortOrder,
      },
    });
  }

  const roleDefs = await prisma.employeeRoleDefinition.findMany();
  const roleIdByCode = new Map(roleDefs.map((r) => [r.code, r.id]));
  const usersForOrgRole = await prisma.user.findMany();
  for (const u of usersForOrgRole) {
    const orgRoleId = roleIdByCode.get(u.role);
    if (orgRoleId) {
      await prisma.user.update({ where: { id: u.id }, data: { orgRoleId } });
    }
  }

  console.log("✅ Database seeded successfully!");
  console.log("\n📋 Login Credentials:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Admin:    admin@digitixlabs.com / Admin@123");
  console.log("HR:       hr@digitixlabs.com / Welcome@123");
  console.log("Manager:  manager@digitixlabs.com / Welcome@123");
  console.log("Employee: priya.sharma@digitixlabs.com / Welcome@123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
