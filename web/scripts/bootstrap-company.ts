/**
 * Clean production bootstrap script for WorkLens.
 *
 * Initializes a new company and initial manager user on a clean database
 * without creating any dummy demo data, demo employees, or sample activities.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-company.ts --company "Acme Corp" --email "manager@acme.com" --password "SecurePass123!" --first "John" --last "Doe"
 *
 * Or via environment variables:
 *   BOOTSTRAP_COMPANY_NAME="Acme Corp"
 *   BOOTSTRAP_MANAGER_EMAIL="manager@acme.com"
 *   BOOTSTRAP_MANAGER_PASSWORD="SecurePass123!"
 *   BOOTSTRAP_MANAGER_FIRST_NAME="John"
 *   BOOTSTRAP_MANAGER_LAST_NAME="Doe"
 *   npm run db:bootstrap
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return undefined;
}

async function main() {
  const companyName =
    getArg("--company") ||
    process.env.BOOTSTRAP_COMPANY_NAME ||
    process.env.COMPANY_NAME;
  const managerEmail =
    getArg("--email") ||
    process.env.BOOTSTRAP_MANAGER_EMAIL ||
    process.env.MANAGER_EMAIL;
  const managerPassword =
    getArg("--password") ||
    process.env.BOOTSTRAP_MANAGER_PASSWORD ||
    process.env.MANAGER_PASSWORD;
  const firstName =
    getArg("--first") ||
    process.env.BOOTSTRAP_MANAGER_FIRST_NAME ||
    "Admin";
  const lastName =
    getArg("--last") ||
    process.env.BOOTSTRAP_MANAGER_LAST_NAME ||
    "Manager";

  if (!companyName || !managerEmail || !managerPassword) {
    console.error(`
Error: Missing required bootstrap parameters.

Usage:
  npx tsx scripts/bootstrap-company.ts \\
    --company "Company Name" \\
    --email "manager@company.com" \\
    --password "SecurePassword123!" \\
    [--first "First"] \\
    [--last "Last"]

Or set environment variables:
  BOOTSTRAP_COMPANY_NAME
  BOOTSTRAP_MANAGER_EMAIL
  BOOTSTRAP_MANAGER_PASSWORD
`);
    process.exit(1);
  }

  if (managerPassword.length < 8) {
    console.error("Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Error: DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: managerEmail },
    });

    if (existingUser) {
      console.error(`Error: User with email "${managerEmail}" already exists.`);
      process.exit(1);
    }

    console.log(`Bootstrapping company "${companyName}"...`);

    const company = await prisma.company.create({
      data: {
        name: companyName,
      },
    });

    const managerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        firstName,
        lastName,
        email: managerEmail,
        position: "Manager",
        status: "ACTIVE",
        hireDate: new Date(),
      },
    });

    const passwordHash = await bcrypt.hash(managerPassword, 12);

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: managerEmployee.id,
        email: managerEmail,
        passwordHash,
        role: "MANAGER",
      },
    });

    console.log(`
✅ Successfully initialized WorkLens for "${company.name}"!
------------------------------------------------------------
Company ID:     ${company.id}
Manager Email:  ${user.email}
Manager Name:   ${managerEmployee.firstName} ${managerEmployee.lastName}
Role:           MANAGER

You can now log in at /login with the configured credentials.
------------------------------------------------------------
`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
