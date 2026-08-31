import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  createAuditLog,
  apiSuccess,
  apiError,
} from "@/lib/api-utils";
import {
  profileSchema,
  profileDetailsSchema,
} from "@/lib/validations";
import { canEmployeeEditOwnProfile } from "@/lib/profile-editing";

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
  profileEditingEnabled: true,
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

function buildProfileDetailsUpdate(
  data: ReturnType<typeof profileDetailsSchema.parse>
) {
  return {
    phone: normalizeOptionalString(data.phone),
    emergencyContact: normalizeOptionalString(data.emergencyContact),
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    joiningDate: new Date(data.joiningDate),
    pan: normalizeUpper(data.pan),
    aadhaarNumber: normalizeOptionalString(data.aadhaarNumber),
    bankName: normalizeOptionalString(data.bankName),
    bankAccountNumber: normalizeOptionalString(data.bankAccountNumber),
    ifscCode: normalizeUpper(data.ifscCode),
  };
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

    const canEditProfile = canEmployeeEditOwnProfile(profile);

    return apiSuccess({
      ...profile,
      canEditProfile:
        profile.role === "EMPLOYEE"
          ? canEditProfile
          : true,
    });
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
      select: {
        role: true,
        profileCompletedAt: true,
        profileEditingEnabled: true,
      },
    });

    if (!currentUser) {
      return apiError("Profile not found", 404);
    }

    const isEmployeeFirstLogin =
      currentUser.role === "EMPLOYEE" && !currentUser.profileCompletedAt;

    const canEditEmployeeProfile = canEmployeeEditOwnProfile(currentUser);

    if (currentUser.role === "EMPLOYEE") {
      if (!canEditEmployeeProfile) {
        return apiError(
          "Your profile is read-only. Contact Admin to enable profile editing.",
          403
        );
      }

      const parsed = profileDetailsSchema.safeParse(body);
      if (!parsed.success) {
        return apiError(parsed.error.errors[0].message);
      }

      const profile = await prisma.user.update({
        where: { id: user!.id },
        data: {
          ...buildProfileDetailsUpdate(parsed.data),
          ...(isEmployeeFirstLogin ? { profileCompletedAt: new Date() } : {}),
        },
        select: profileSelect,
      });

      await createAuditLog({
        userId: user!.id,
        action: "UPDATE",
        entity: "User",
        entityId: user!.id,
        details: isEmployeeFirstLogin
          ? "Completed first-login profile setup"
          : "Updated employee profile details",
      });

      return apiSuccess({
        ...profile,
        canEditProfile: canEmployeeEditOwnProfile(profile),
      });
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

    return apiSuccess({
      ...profile,
      canEditProfile: true,
    });
  } catch (err) {
    console.error("Profile PATCH error:", err);
    return apiError("Internal server error", 500);
  }
}
