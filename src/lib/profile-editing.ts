import type { RoleName } from "@prisma/client";

export function canEmployeeEditOwnProfile(user: {
  role: RoleName;
  profileCompletedAt: Date | string | null;
  profileEditingEnabled: boolean;
}) {
  if (user.role !== "EMPLOYEE") {
    return false;
  }

  if (!user.profileCompletedAt) {
    return true;
  }

  return user.profileEditingEnabled;
}

export function isEmployeeProfileReadOnly(user: {
  role: RoleName;
  profileCompletedAt: Date | string | null;
  profileEditingEnabled: boolean;
}) {
  return user.role === "EMPLOYEE" && !!user.profileCompletedAt && !user.profileEditingEnabled;
}
