import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain uppercase letter")
      .regex(/[a-z]/, "Must contain lowercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain uppercase letter")
      .regex(/[a-z]/, "Must contain lowercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export const employeeSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "HR", "MANAGER", "EMPLOYEE"]),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]),
  departmentId: z.string().optional(),
  designationId: z.string().optional(),
  managerId: z.string().optional(),
  joiningDate: z.string(),
  dateOfBirth: z.string().optional(),
  emergencyContact: z.string().optional(),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format (e.g. ABCDE1234F)")
    .optional()
    .or(z.literal("")),
  baseSalary: z.coerce.number().min(0).optional(),
  ctc: z.coerce.number().min(0, "CTC must be a positive amount").optional(),
  incentive: z.coerce.number().min(0).optional(),
  reimbursement: z.coerce.number().min(0).optional(),
  status: z.enum(["ACTIVE", "LEFT", "TERMINATED"]).optional(),
});

export const leaveApplicationSchema = z
  .object({
    leaveTypeId: z.string().min(1, "Leave type is required"),
    fromDate: z.string().min(1, "From date is required"),
    toDate: z.string().min(1, "To date is required"),
    reason: z.string().min(10, "Reason must be at least 10 characters"),
    attachment: z.string().optional(),
    emergencyContact: z.string().optional(),
  })
  .refine(
    (data) => {
      const from = new Date(data.fromDate);
      const to = new Date(data.toDate);
      return to >= from;
    },
    { message: "To date must be after from date", path: ["toDate"] }
  )
  .refine(
    (data) => {
      const from = new Date(data.fromDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return from >= today;
    },
    { message: "Cannot apply for past dates", path: ["fromDate"] }
  );

export const adminLeaveApplicationSchema = z
  .object({
    userId: z.string().min(1, "Employee is required"),
    leaveTypeId: z.string().min(1, "Leave type is required"),
    fromDate: z.string().min(1, "From date is required"),
    toDate: z.string().min(1, "To date is required"),
    reason: z.string().min(10, "Reason must be at least 10 characters"),
    attachment: z.string().optional(),
    emergencyContact: z.string().optional(),
  })
  .refine(
    (data) => {
      const from = new Date(data.fromDate);
      const to = new Date(data.toDate);
      return to >= from;
    },
    { message: "To date must be after from date", path: ["toDate"] }
  );

export const leaveBalanceUpdateSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  leaveTypeId: z.string().min(1, "Leave type is required"),
  year: z.number().int().min(2020).max(2100),
  totalDays: z.number().min(0, "Total days cannot be negative").optional(),
  usedDays: z.number().min(0, "Used days cannot be negative").optional(),
}).refine((data) => data.totalDays !== undefined || data.usedDays !== undefined, {
  message: "Provide totalDays and/or usedDays to update",
});

export const workScheduleUpdateSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  workStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time (HH:MM)"),
  workEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time (HH:MM)"),
  lateThreshold: z.number().int().min(0).max(120).optional(),
});

export const workScheduleEntrySchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  workStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid start time (HH:MM)"),
  workEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid end time (HH:MM)"),
  lateThreshold: z.number().int().min(0).max(120).optional(),
});

export const kraRatingSchema = z
  .number()
  .min(1, "Rating must be at least 1")
  .max(5, "Rating must be at most 5");

export const kraItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "KRA Name is required"),
  measure: z.string().min(1, "Measure is required"),
  weight: z.number().positive("Weight must be greater than 0").max(100),
  description: z.string().optional(),
  achievement: z.string().optional(),
  employeeComments: z.string().optional(),
  employeeRating: kraRatingSchema.optional().nullable(),
  managerRating: kraRatingSchema.optional().nullable(),
  managerComments: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const kraPercentageSchema = z
  .number()
  .min(0, "Percentage must be at least 0")
  .max(100, "Percentage must be at most 100");

export const employeeKraSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  name: z.string().min(2, "KRA is required"),
  measure: z.string().min(1, "Measure is required"),
  weight: z
    .number()
    .positive("Weight must be greater than 0")
    .max(100)
    .optional()
    .nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export const employeeKraUpdateSchema = z.object({
  name: z.string().min(2, "KRA is required").optional(),
  measure: z.string().min(1, "Measure is required").optional(),
  weight: z
    .number()
    .positive("Weight must be greater than 0")
    .max(100)
    .optional()
    .nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export const employeeKraConfigSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  reviewCycle: z.enum(["MONTHLY", "QUARTERLY"]).optional(),
  periodLabel: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const employeeKraFinalizeSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  reviewCycle: z.enum(["MONTHLY", "QUARTERLY"]).optional(),
  periodLabel: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const kraCreateSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  userId: z.string().optional(),
});

export const kraUpdateSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      employeeComments: z.string().optional(),
      employeePercentage: kraPercentageSchema.optional().nullable(),
    })
  ).min(1, "At least one KRA item is required"),
});

export const kraReviewSubmitSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      managerPercentage: kraPercentageSchema.optional().nullable(),
      managerComments: z.string().optional(),
    })
  ).min(1),
});

export const payslipGenerateSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  salary: z.number().positive("Basic salary must be greater than 0"),
  bonus: z.number().min(0).default(0),
  incentive: z.number().min(0).default(0),
  reimbursement: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
});

export const companyPolicySchema = z.object({
  title: z.string().min(2, "Policy title is required"),
  content: z.string().min(10, "Policy content must be at least 10 characters"),
  sortOrder: z.number().int().min(0).optional(),
});

export const departmentSchema = z.object({
  name: z.string().min(2, "Department name is required"),
  description: z.string().optional(),
});

export const designationSchema = z.object({
  name: z.string().min(2, "Designation name is required"),
  description: z.string().optional(),
});

export const leaveTypeSchema = z.object({
  name: z.string().min(2, "Leave type name is required"),
  code: z.string().min(2, "Code is required").max(10),
  description: z.string().optional(),
  defaultDays: z.number().min(0),
  isPaid: z.boolean().default(true),
  requiresAttachment: z.boolean().default(false),
});

export const payslipSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  salary: z.number().positive("Basic salary must be greater than 0"),
  bonus: z.number().min(0).default(0),
  incentive: z.number().min(0).default(0),
  reimbursement: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
  fileUrl: z.string().optional(),
});

export const announcementSchema = z.object({
  title: z.string().min(3, "Title is required"),
  content: z.string().min(10, "Content is required"),
});

export const companySettingsSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  companyEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  companyTan: z.string().optional().or(z.literal("")),
  companyLogo: z.string().optional(),
  leavePolicy: z.string().optional(),
  attendanceRules: z.string().optional(),
  passwordPolicy: z.string().optional(),
  sessionTimeout: z.number().min(5).max(480),
  workStartTime: z.string().min(1),
  workEndTime: z.string().min(1),
  lateThreshold: z.number().min(0).max(120),
  orgHierarchyVisibleToEmployees: z.boolean().optional(),
  orgHierarchyVisibleToManagers: z.boolean().optional(),
  dependentDetailsEnabled: z.boolean().optional(),
});

export const employeeDependentSchema = z.object({
  name: z.string().min(2, "Dependent name is required"),
  relationship: z.string().min(2, "Relationship is required"),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export const attendanceCheckInSchema = z.object({
  action: z.enum(["check-in", "check-out"]),
  notes: z.string().optional(),
  lateReason: z.string().optional(),
});

export const assignManagerSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  managerId: z.string().nullable().optional(),
  effectiveFrom: z.string().optional(),
});

export const employeeDocumentUploadSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  title: z.string().min(2, "Title is required"),
  category: z.enum([
    "APPRAISAL",
    "LAPTOP_UNDERTAKING",
    "OFFER_LETTER",
    "APPOINTMENT_LETTER",
    "NDA",
    "ID_PROOF",
    "OTHER",
  ]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type LeaveApplicationInput = z.infer<typeof leaveApplicationSchema>;
export type AdminLeaveApplicationInput = z.infer<typeof adminLeaveApplicationSchema>;
export type LeaveBalanceUpdateInput = z.infer<typeof leaveBalanceUpdateSchema>;
export type WorkScheduleUpdateInput = z.infer<typeof workScheduleUpdateSchema>;
export type WorkScheduleEntryInput = z.infer<typeof workScheduleEntrySchema>;
export type EmployeeKraInput = z.infer<typeof employeeKraSchema>;
export type EmployeeKraUpdateInput = z.infer<typeof employeeKraUpdateSchema>;
export type KraCreateInput = z.infer<typeof kraCreateSchema>;
export type KraUpdateInput = z.infer<typeof kraUpdateSchema>;
export type PayslipGenerateInput = z.infer<typeof payslipGenerateSchema>;
export type CompanyPolicyInput = z.infer<typeof companyPolicySchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type DesignationInput = z.infer<typeof designationSchema>;
export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;
export type PayslipInput = z.infer<typeof payslipSchema>;
export type AnnouncementInput = z.infer<typeof announcementSchema>;
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
export type EmployeeDependentInput = z.infer<typeof employeeDependentSchema>;
