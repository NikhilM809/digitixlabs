"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { RoleName } from "@prisma/client";
import type { WnRole as Role } from "@/worknest/lib/user-adapter";
import { prisma } from "@/lib/prisma";
import { assertRole, requireUser } from "@/worknest/lib/permissions";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? name;
  const lastName = parts.slice(1).join(" ") || "-";
  return { firstName, lastName };
}

function toRoleName(role: Role): RoleName {
  if (role === "ADMIN") return "ADMIN";
  if (role === "MANAGER") return "MANAGER";
  return "EMPLOYEE";
}

async function nextEmployeeId() {
  const count = await prisma.user.count();
  return `WN-${String(count + 1).padStart(4, "0")}`;
}

export async function createUser(formData: FormData) {
  const actor = await requireUser();
  assertRole(actor, ["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "EMPLOYEE") as Role;
  const password = String(formData.get("password") ?? "");
  if (!name || !email) return { error: "Name and email are required." };
  if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(role)) return { error: "Select a valid role." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "That email is already in use." };

  const { firstName, lastName } = splitName(name);
  await prisma.user.create({
    data: {
      employeeId: await nextEmployeeId(),
      firstName,
      lastName,
      email,
      role: toRoleName(role),
      password: await bcrypt.hash(password, 10),
      status: "ACTIVE",
    },
  });
  revalidatePath("/worknest/employees");
  return { ok: true };
}

export async function updateUser(userId: string, formData: FormData) {
  const actor = await requireUser();
  assertRole(actor, ["ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "") as Role;
  const active = formData.get("active") === "on";
  const password = String(formData.get("password") ?? "");
  if (!name || !email) return { error: "Name and email are required." };

  const { firstName, lastName } = splitName(name);
  const data: Record<string, unknown> = {
    firstName,
    lastName,
    email,
    role: toRoleName(role),
    status: active ? "ACTIVE" : "LEFT",
  };
  if (password) {
    if (password.length < 8) return { error: "Password must be at least 8 characters." };
    data.password = await bcrypt.hash(password, 10);
  }
  await prisma.user.update({ where: { id: userId }, data });
  revalidatePath("/worknest/employees");
  return { ok: true };
}
