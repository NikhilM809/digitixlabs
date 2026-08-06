import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { RoleName } from "@prisma/client";

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
  session: {
    strategy: "jwt",
    maxAge: 30 * 60, // 30 minutes session timeout
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
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
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.employeeId = user.employeeId;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.role = user.role;
        token.avatar = user.avatar;
        token.departmentId = user.departmentId;
        token.mustChangePassword = user.mustChangePassword;
      }

      if (trigger === "update" && session) {
        token.firstName = session.firstName ?? token.firstName;
        token.lastName = session.lastName ?? token.lastName;
        token.avatar = session.avatar ?? token.avatar;
        token.mustChangePassword = session.mustChangePassword ?? token.mustChangePassword;
      }

      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id as string,
        employeeId: token.employeeId as string,
        email: token.email as string,
        firstName: token.firstName as string,
        lastName: token.lastName as string,
        role: token.role as RoleName,
        avatar: token.avatar as string | null | undefined,
        departmentId: token.departmentId as string | null | undefined,
        mustChangePassword: token.mustChangePassword as boolean,
      } as typeof session.user;
      return session;
    },
  },
});

export function hasRole(userRole: RoleName, allowedRoles: RoleName[]) {
  return allowedRoles.includes(userRole);
}

export function isAdmin(role: RoleName) {
  return role === "ADMIN";
}

export function isManager(role: RoleName) {
  return role === "MANAGER" || role === "ADMIN";
}
