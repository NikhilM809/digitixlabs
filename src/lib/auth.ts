import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { AUTH_SECRET } from "@/lib/auth-constants";
import type { RoleName } from "@prisma/client";
import {
  canApproveLeave,
  isAdmin as checkIsAdmin,
} from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      employeeId: string;
      email: string;
      firstName: string;
      lastName: string;
      role: RoleName;
      avatar?: string | null;
      departmentId?: string | null;
      mustChangePassword: boolean;
    };
  }

  interface User {
    id: string;
    employeeId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: RoleName;
    avatar?: string | null;
    departmentId?: string | null;
    mustChangePassword: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    role: RoleName;
    avatar?: string | null;
    departmentId?: string | null;
    mustChangePassword: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: AUTH_SECRET,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || user.status !== "ACTIVE") {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          employeeId: user.employeeId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar,
          departmentId: user.departmentId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});

export function hasRole(userRole: RoleName, allowedRoles: RoleName[]) {
  return allowedRoles.includes(userRole);
}

export function isAdmin(role: RoleName) {
  return checkIsAdmin(role);
}

export function isManager(role: RoleName) {
  return canApproveLeave(role);
}
