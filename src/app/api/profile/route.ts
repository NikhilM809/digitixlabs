import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  createAuditLog,
  apiSuccess,
  apiError,
} from "@/lib/api-utils";
import { profileSchema } from "@/lib/validations";

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
  bankAccountNumber: true,
  mustChangePassword: true,
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
      ("firstName" in body ||
        "lastName" in body ||
        "pan" in body ||
        "aadhaarNumber" in body ||
        "bankAccountNumber" in body)
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
        phone: parsed.data.phone,
        emergencyContact: parsed.data.emergencyContact,
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
