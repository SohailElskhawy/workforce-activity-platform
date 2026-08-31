import "server-only";

import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import type { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";

import { EMPLOYEE_HOME_ROUTE, LOGIN_ROUTE, MANAGER_HOME_ROUTE } from "@/lib/auth-routes";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/src/generated/prisma/enums";
import { loginSchema } from "@/lib/validation/auth";

const DEMO_ROLES: ReadonlySet<UserRole> = new Set(["MANAGER", "EMPLOYEE"]);

async function authenticateCredentials(credentials: unknown) {
  const parsedCredentials = loginSchema.safeParse(credentials);

  if (!parsedCredentials.success) {
    return null;
  }

  const { email, password } = parsedCredentials.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        companyId: true,
        employeeId: true,
        email: true,
        passwordHash: true,
        role: true,
        employee: { select: { companyId: true } },
      },
    });

    if (!user || !DEMO_ROLES.has(user.role)) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return null;
    }

    if (
      user.role === "EMPLOYEE" &&
      (!user.employeeId || user.employee?.companyId !== user.companyId)
    ) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      companyId: user.companyId,
      employeeId: user.employeeId,
      role: user.role,
    };
  } catch {
    // Keep operational failures indistinguishable from invalid credentials.
    console.error("Credential authentication failed.");
    return null;
  }
}

export const authOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authenticateCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.companyId = user.companyId;
        token.employeeId = user.employeeId;
        token.role = user.role;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.companyId = token.companyId;
      session.user.employeeId = token.employeeId;
      session.user.role = token.role;

      return session;
    },
  },
} satisfies NextAuthOptions;

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireUser(): Promise<Session> {
  const session = await getAuthSession();
  if (!session?.user) redirect(LOGIN_ROUTE);
  return session;
}

export async function requireManager(): Promise<Session> {
  const session = await requireUser();
  if (session.user.role !== "MANAGER") {
    redirect(session.user.role === "EMPLOYEE" ? EMPLOYEE_HOME_ROUTE : LOGIN_ROUTE);
  }
  return session;
}

export async function requireEmployee(): Promise<Session> {
  const session = await requireUser();
  if (session.user.role !== "EMPLOYEE") {
    redirect(session.user.role === "MANAGER" ? MANAGER_HOME_ROUTE : LOGIN_ROUTE);
  }
  if (!session.user.employeeId) redirect(LOGIN_ROUTE);

  const employee = await prisma.employee.findFirst({
    where: {
      id: session.user.employeeId,
      companyId: session.user.companyId,
      user: { is: { id: session.user.id } },
    },
    select: { id: true },
  });
  if (!employee) redirect(LOGIN_ROUTE);

  return session;
}

type TenantIdentity = Pick<Session["user"], "companyId">;

/**
 * Adds the authenticated tenant to a company-owned Prisma query. The tenant
 * value is written last so it cannot be overridden by caller input.
 */
export function withTenant<T extends object>(user: TenantIdentity, where: T) {
  return { ...where, companyId: user.companyId };
}

export function tenantResourceWhere(user: TenantIdentity, id: string) {
  return withTenant(user, { id });
}
