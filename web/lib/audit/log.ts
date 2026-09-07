import type { Prisma } from "@/src/generated/prisma/client";

export type AuditMetadata = Prisma.InputJsonObject;

export type AuditEntry = {
  companyId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
};

type AuditTransaction = {
  auditLog: {
    create(args: { data: Prisma.AuditLogUncheckedCreateInput }): Promise<unknown>;
  };
};

/** Writes an audit record through the caller's active transaction. */
export async function writeAudit(
  transaction: AuditTransaction,
  entry: AuditEntry,
) {
  await transaction.auditLog.create({
    data: {
      companyId: entry.companyId,
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
