/** Operator-only initial account provisioning. Never imported by an HTTP route. */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createUserSchema, parse } from "@/lib/admin/validation";
import { writeAudit } from "@/lib/audit/log";
import { ApiError } from "@/lib/http/errors";

export async function bootstrapSuperAdmin(raw: unknown, db = prisma) {
  const input = parse(createUserSchema, raw);
  if (input.role !== "SUPER_ADMIN")
    throw new ApiError(
      "VALIDATION_ERROR",
      "Super Admin role is required.",
      400,
    );
  return db.$transaction(
    async (tx) => {
      if (await tx.user.count({ where: { role: "SUPER_ADMIN" } }))
        throw new ApiError(
          "CONFLICT",
          "A Super Admin already exists. Use the admin area to create additional users.",
          409,
        );
      if (
        !(await tx.company.findUnique({
          where: { id: input.companyId },
          select: { id: true },
        }))
      )
        throw new ApiError(
          "NOT_FOUND",
          "Create the company with the existing bootstrap first.",
          404,
        );
      const user = await tx.user.create({
        data: {
          companyId: input.companyId,
          email: input.email,
          role: "SUPER_ADMIN",
          passwordHash: await bcrypt.hash(input.temporaryPassword, 12),
        },
        select: { id: true },
      });
      await writeAudit(tx, {
        companyId: input.companyId,
        actorUserId: null,
        action: "USER_CREATED",
        entityType: "User",
        entityId: user.id,
        metadata: { role: "SUPER_ADMIN" },
      });
      return user;
    },
    { isolationLevel: "Serializable" },
  );
}
