import "server-only";

import { randomBytes } from "node:crypto";

import type { AuthContext } from "@/lib/auth-context";
import { writeAudit } from "@/lib/audit/log";
import { tenantWhere } from "@/lib/auth-context";
import { createAgentToken, hashAgentToken } from "@/lib/agent/token";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import type { RegisterDeviceInput } from "@/lib/validation/devices";
import { EmployeeStatus } from "@/src/generated/prisma/enums";

function createPublicDeviceId() {
  return `PC-${randomBytes(12).toString("hex").toUpperCase()}`;
}

export async function registerDevice(
  context: AuthContext,
  input: RegisterDeviceInput,
) {
  const employee = await prisma.employee.findFirst({
    where: tenantWhere(context.companyId, {
      id: input.employeeId,
      status: EmployeeStatus.ACTIVE,
    }),
    select: { id: true },
  });

  if (!employee) {
    throw new ApiError("NOT_FOUND", "Employee not found.", 404);
  }

  const token = createAgentToken();
  const device = await prisma.device.create({
    data: {
      agentTokenHash: hashAgentToken(token),
      companyId: context.companyId,
      deviceId: createPublicDeviceId(),
      employeeId: employee.id,
      name: input.name,
    },
    select: { deviceId: true },
  });

  return { deviceId: device.deviceId, token };
}

export async function revokeDevice(context: AuthContext, deviceId: string) {
  return prisma.$transaction(async (transaction) => {
    const device = await transaction.device.findFirst({
      where: tenantWhere(context.companyId, { id: deviceId }),
      select: { id: true, deviceId: true, employeeId: true, isActive: true },
    });

    if (!device) {
      throw new ApiError("NOT_FOUND", "Device not found.", 404);
    }

    const updated = await transaction.device.update({
      where: { id: device.id },
      data: { isActive: false },
      select: { id: true, deviceId: true, isActive: true },
    });

    await writeAudit(transaction, {
      companyId: context.companyId,
      actorUserId: context.userId,
      action: "DEVICE_REVOKED",
      entityType: "Device",
      entityId: device.id,
      metadata: {
        devicePublicId: device.deviceId,
        employeeId: device.employeeId,
      },
    });

    return updated;
  });
}

