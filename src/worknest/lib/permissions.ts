import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { RoleName } from "@prisma/client";
import { toWnRole, userDisplayName, type WnRole } from "@/worknest/lib/user-adapter";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: WnRole;
  hrmsRole: RoleName;
};

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return null;
  return {
    id: session.user.id,
    name: userDisplayName({
      firstName: session.user.firstName,
      lastName: session.user.lastName,
    }),
    email: session.user.email ?? "",
    role: toWnRole(session.user.role),
    hrmsRole: session.user.role,
  } satisfies SessionUser;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/worknest/dashboard");
  return user;
}

export async function requireRole(...roles: WnRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect("/worknest/dashboard");
  }
  return user;
}

export function canSeeFinance(role: WnRole) {
  return role === "ADMIN";
}

export function isStaff(role: WnRole) {
  return role === "ADMIN" || role === "MANAGER";
}

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export function assertRole(user: SessionUser, roles: WnRole[], message = "You do not have permission to do that.") {
  if (!roles.includes(user.role)) {
    throw new ActionError(message);
  }
}

export async function requireApiRole(...roles: WnRole[]) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }),
    };
  }
  if (!roles.includes(user.role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 }),
    };
  }
  return { ok: true as const, user };
}
