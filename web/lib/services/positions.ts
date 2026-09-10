import { assertRole, type AuthContext } from "@/lib/auth-context";
import { writeAudit, type AuditEntry } from "@/lib/audit/log";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import type { CreatePositionInput } from "@/lib/validation/positions";

export type PositionRecord = {
  id: string;
  companyId: string;
  name: string;
};

export type PositionStore = {
  listPositions(companyId: string): Promise<PositionRecord[]>;
  findPositionById(id: string, companyId: string): Promise<PositionRecord | null>;
  findPositionByName(name: string, companyId: string): Promise<PositionRecord | null>;
  createPosition(data: { companyId: string; name: string }): Promise<PositionRecord>;
  hasAssignedEmployees(positionId: string): Promise<boolean>;
  deletePosition(positionId: string): Promise<void>;
  writeAudit(entry: AuditEntry): Promise<void>;
};

export const defaultPositionStore: PositionStore = {
  async listPositions(companyId) {
    return prisma.position.findMany({
      where: { companyId },
      select: { id: true, companyId: true, name: true },
      orderBy: { name: "asc" },
    });
  },
  async findPositionById(id, companyId) {
    return prisma.position.findFirst({
      where: { id, companyId },
      select: { id: true, companyId: true, name: true },
    });
  },
  async findPositionByName(name, companyId) {
    return prisma.position.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, companyId },
      select: { id: true, companyId: true, name: true },
    });
  },
  async createPosition(data) {
    return prisma.position.create({
      data,
      select: { id: true, companyId: true, name: true },
    });
  },
  async hasAssignedEmployees(positionId) {
    return (await prisma.employee.count({ where: { positionId } })) > 0;
  },
  async deletePosition(positionId) {
    await prisma.position.delete({ where: { id: positionId } });
  },
  async writeAudit(entry) {
    await writeAudit(prisma, entry);
  },
};

export async function listPositionsWithStore(
  context: AuthContext,
  store: PositionStore = defaultPositionStore,
) {
  assertRole(context, ["MANAGER"]);
  return store.listPositions(context.companyId);
}

export async function createPositionWithStore(
  context: AuthContext,
  input: CreatePositionInput,
  store: PositionStore = defaultPositionStore,
) {
  assertRole(context, ["MANAGER"]);

  if (await store.findPositionByName(input.name, context.companyId)) {
    throw new ApiError("CONFLICT", "This position already exists.", 409);
  }

  const position = await store.createPosition({
    companyId: context.companyId,
    name: input.name,
  });
  await store.writeAudit({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "POSITION_CREATED",
    entityType: "Position",
    entityId: position.id,
    metadata: { name: position.name },
  });
  return position;
}

export async function deletePositionWithStore(
  context: AuthContext,
  positionId: string,
  store: PositionStore = defaultPositionStore,
) {
  assertRole(context, ["MANAGER"]);

  const position = await store.findPositionById(positionId, context.companyId);
  if (!position) {
    throw new ApiError("NOT_FOUND", "Position not found.", 404);
  }
  if (await store.hasAssignedEmployees(position.id)) {
    throw new ApiError(
      "CONFLICT",
      "Unassign this position from employees before deleting it.",
      409,
    );
  }

  await store.deletePosition(position.id);
  await store.writeAudit({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "POSITION_DELETED",
    entityType: "Position",
    entityId: position.id,
    metadata: { name: position.name },
  });
}
