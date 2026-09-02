export type AuditMetadata = Record<string, string | number | boolean | null>;

export type AuditEntry = {
  companyId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: AuditMetadata;
};

type AuditTransaction = {
  auditLog: {
    create(args: { data: AuditEntry }): Promise<unknown>;
  };
};

/** Writes an audit record through the caller's active transaction. */
export async function writeAudit(
  transaction: AuditTransaction,
  entry: AuditEntry,
) {
  await transaction.auditLog.create({ data: entry });
}
