import type { RoleName } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toWnRole, userDisplayName, type WnRole } from "@/worknest/lib/user-adapter";

export type WorknestPerson = {
  id: string;
  name: string;
  email: string;
  role: WnRole;
  active: boolean;
};

export function mapUserForWorknest(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: RoleName;
  status: string;
}): WorknestPerson {
  return {
    id: user.id,
    name: userDisplayName(user),
    email: user.email,
    role: toWnRole(user.role),
    active: user.status === "ACTIVE",
  };
}

export async function listWorknestPeople(options?: {
  roles?: WnRole[];
  activeOnly?: boolean;
}) {
  const roleFilter = options?.roles?.length
    ? {
        role: {
          in: options.roles.flatMap((role) => {
            if (role === "ADMIN") return ["ADMIN", "HR"] as RoleName[];
            if (role === "MANAGER") return ["MANAGER"] as RoleName[];
            return ["EMPLOYEE"] as RoleName[];
          }),
        },
      }
    : {};

  const users = await prisma.user.findMany({
    where: {
      ...roleFilter,
      ...(options?.activeOnly ? { status: "ACTIVE" } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return users.map(mapUserForWorknest);
}
