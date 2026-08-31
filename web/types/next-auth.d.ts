import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/src/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      companyId: string;
      role: UserRole;
      employeeId: string | null;
    };
  }

  interface User {
    companyId: string;
    role: UserRole;
    employeeId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    companyId: string;
    role: UserRole;
    employeeId: string | null;
  }
}
