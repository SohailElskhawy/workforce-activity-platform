import "server-only";

import { randomBytes } from "node:crypto";

import type { AuthContext } from "@/lib/auth-context";
import { tenantWhere } from "@/lib/auth-context";
import { createAgentToken, hashAgentToken } from "@/lib/agent/token";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import type { RegisterDeviceInput } from "@/lib/validation/devices";
import { EmployeeStatus } from "@/src/generated/prisma/enums";

function createPublicDeviceId() {
  return `PC-${randomBytes(12).toString("hex").toUpperCase()}`;
}

export async function registerDevice(context: AuthContext, input: RegisterDeviceInput) {
  const employee = await prisma.employee.findFirst({
    where: tenantWhere(context.companyId, { id: input.employeeId, status: EmployeeStatus.ACTIVE }),
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
