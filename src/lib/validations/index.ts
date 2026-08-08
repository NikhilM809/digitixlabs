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
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
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
});

export const leaveApplicationSchema = z
  .object({
    leaveTypeId: z.string().min(1, "Leave type is required"),
    fromDate: z.string().min(1, "From date is required"),
    toDate: z.string().min(1, "To date is required"),
    isHalfDay: z.boolean().default(false),
    halfDayPeriod: z.enum(["FIRST_HALF", "SECOND_HALF"]).optional(),
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
  )
  .refine(
    (data) => !data.isHalfDay || !!data.halfDayPeriod,
    { message: "Please select half day period", path: ["halfDayPeriod"] }
  );

export const adminLeaveApplicationSchema = z
  .object({
    userId: z.string().min(1, "Employee is required"),
    leaveTypeId: z.string().min(1, "Leave type is required"),
    fromDate: z.string().min(1, "From date is required"),
    toDate: z.string().min(1, "To date is required"),
    isHalfDay: z.boolean().default(false),
    halfDayPeriod: z.enum(["FIRST_HALF", "SECOND_HALF"]).optional(),
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
    (data) => !data.isHalfDay || !!data.halfDayPeriod,
    { message: "Please select half day period", path: ["halfDayPeriod"] }
  );

export const leaveBalanceUpdateSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  leaveTypeId: z.string().min(1, "Leave type is required"),
  year: z.number().int().min(2020).max(2100),
  totalDays: z.number().min(0, "Total days cannot be negative"),
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

export const holidaySchema = z.object({
  name: z.string().min(2, "Holiday name is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().optional(),
  isRegional: z.boolean().default(false),
  region: z.string().optional(),
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
  salary: z.number().min(0),
  bonus: z.number().min(0).default(0),
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
  companyLogo: z.string().optional(),
  leavePolicy: z.string().optional(),
  attendanceRules: z.string().optional(),
  passwordPolicy: z.string().optional(),
  sessionTimeout: z.number().min(5).max(480),
  workStartTime: z.string().min(1),
  workEndTime: z.string().min(1),
  lateThreshold: z.number().min(0).max(120),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type LeaveApplicationInput = z.infer<typeof leaveApplicationSchema>;
export type AdminLeaveApplicationInput = z.infer<typeof adminLeaveApplicationSchema>;
export type LeaveBalanceUpdateInput = z.infer<typeof leaveBalanceUpdateSchema>;
export type CompanyPolicyInput = z.infer<typeof companyPolicySchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type DesignationInput = z.infer<typeof designationSchema>;
export type HolidayInput = z.infer<typeof holidaySchema>;
export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;
export type PayslipInput = z.infer<typeof payslipSchema>;
export type AnnouncementInput = z.infer<typeof announcementSchema>;
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
