import { NextResponse } from "next/server";
import type { RoleName, UserStatus, AuditAction } from "@prisma/client";
import { auth, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSessionUser() {
  const session = await auth();
  if (!session?.user) return null;
  return session.user;
}

export async function requireAuth(allowedRoles?: RoleName[]) {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), user: null };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { status: true, role: true },
  });

  if (!dbUser || dbUser.status !== ("ACTIVE" as UserStatus)) {
    return { error: NextResponse.json({ error: "Account is inactive" }, { status: 403 }), user: null };
  }

  const activeRole = dbUser.role;
  if (allowedRoles && !hasRole(activeRole, allowedRoles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), user: null };
  }

  return { error: null, user: { ...user, role: activeRole } };
}

export async function createAuditLog(params: {
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.auditLog.create({ data: params });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export async function createNotification(params: {
  userId: string;
  type: import("@prisma/client").NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  return prisma.notification.create({ data: params });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}
