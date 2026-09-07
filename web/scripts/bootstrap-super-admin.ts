import "dotenv/config";
import { bootstrapSuperAdmin } from "./bootstrap-super-admin-core";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http/errors";

async function main() {
  try {
    await bootstrapSuperAdmin({
      role: "SUPER_ADMIN",
      companyId: process.env.BOOTSTRAP_ADMIN_COMPANY_ID,
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      temporaryPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    });
    console.log("Initial Super Admin created.");
  } catch (error) {
    console.error(
      error instanceof ApiError
        ? error.message
        : "Super Admin bootstrap failed. Check configuration and account uniqueness.",
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
