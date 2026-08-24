import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  createAuditLog,
  apiSuccess,
  apiError,
} from "@/lib/api-utils";
import { profileSchema, profileFirstLoginSchema } from "@/lib/validations";

const profileSelect = {
  id: true,
  employeeId: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
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
  mustChangePassword: true,
  profileCompletedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  orgRole: { select: { id: true, name: true, code: true } },
  manager: {
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} as const;

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeUpper(value?: string | null) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toUpperCase() : null;
}

export async function GET() {
  try {
    const { error, user } = await requireAuth();
    if (error) return error;

    const profile = await prisma.user.findUnique({
      where: { id: user!.id },
      select: profileSelect,
    });

    if (!profile) {
      return apiError("Profile not found", 404);
    }

    return apiSuccess(profile);
  } catch (err) {
    console.error("Profile GET error:", err);
    return apiError("Internal server error", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const { error, user } = await requireAuth();
    if (error) return error;

    const body = await request.json();

    if (
      body &&
      typeof body === "object" &&
      ("firstName" in body || "lastName" in body || "email" in body)
    ) {
      return apiError(
        "You cannot update your name or email. Please contact Admin or HR.",
        403
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: user!.id },
      select: { role: true, profileCompletedAt: true },
    });

    if (!currentUser) {
      return apiError("Profile not found", 404);
    }

    const isEmployeeFirstLogin =
      currentUser.role === "EMPLOYEE" && !currentUser.profileCompletedAt;

    if (isEmployeeFirstLogin) {
      const parsed = profileFirstLoginSchema.safeParse(body);
      if (!parsed.success) {
        return apiError(parsed.error.errors[0].message);
      }

      const profile = await prisma.user.update({
        where: { id: user!.id },
        data: {
          phone: normalizeOptionalString(parsed.data.phone),
          emergencyContact: normalizeOptionalString(parsed.data.emergencyContact),
          dateOfBirth: parsed.data.dateOfBirth
            ? new Date(parsed.data.dateOfBirth)
            : null,
          joiningDate: new Date(parsed.data.joiningDate),
          pan: normalizeUpper(parsed.data.pan),
          aadhaarNumber: normalizeOptionalString(parsed.data.aadhaarNumber),
          bankName: normalizeOptionalString(parsed.data.bankName),
          bankAccountNumber: normalizeOptionalString(parsed.data.bankAccountNumber),
          ifscCode: normalizeUpper(parsed.data.ifscCode),
          profileCompletedAt: new Date(),
        },
        select: profileSelect,
      });

      await createAuditLog({
        userId: user!.id,
        action: "UPDATE",
        entity: "User",
        entityId: user!.id,
        details: "Completed first-login profile setup",
      });

      return apiSuccess(profile);
    }

    if (currentUser.role === "EMPLOYEE" && currentUser.profileCompletedAt) {
      return apiError(
        "Your profile has already been submitted. Contact Admin or HR for changes.",
        403
      );
    }

    if (
      body &&
      typeof body === "object" &&
      ("pan" in body ||
        "aadhaarNumber" in body ||
        "bankName" in body ||
        "bankAccountNumber" in body ||
        "ifscCode" in body ||
        "joiningDate" in body ||
        "dateOfBirth" in body)
    ) {
      return apiError(
        "You cannot update restricted fields. Please contact Admin or HR.",
        403
      );
    }

    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message);
    }

    const profile = await prisma.user.update({
      where: { id: user!.id },
      data: {
        phone: normalizeOptionalString(parsed.data.phone),
        emergencyContact: normalizeOptionalString(parsed.data.emergencyContact),
      },
      select: profileSelect,
    });

    await createAuditLog({
      userId: user!.id,
      action: "UPDATE",
      entity: "User",
      entityId: user!.id,
      details: JSON.stringify(parsed.data),
    });

    return apiSuccess(profile);
  } catch (err) {
    console.error("Profile PATCH error:", err);
    return apiError("Internal server error", 500);
  }
}
