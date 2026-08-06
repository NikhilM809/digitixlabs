import type { NextAuthConfig } from "next-auth";
import type { RoleName } from "@prisma/client";
import { AUTH_SECRET } from "@/lib/auth-secret";

export const authConfig = {
  secret: AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 30 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
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
        token.mustChangePassword =
          session.mustChangePassword ?? token.mustChangePassword;
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
} satisfies NextAuthConfig;
