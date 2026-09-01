import { timingSafeEqual } from "node:crypto";

import { hashAgentToken } from "@/lib/agent/token";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";

type DeviceLookup = {
  id: string;
  deviceId: string;
  companyId: string;
  employeeId: string;
  agentTokenHash: string;
  isActive: boolean;
};

export type AuthenticatedDevice = {
  databaseId: string;
  publicId: string;
  companyId: string;
  employeeId: string;
};

type DeviceLoader = (publicId: string) => Promise<DeviceLookup | null>;

async function loadDevice(publicId: string): Promise<DeviceLookup | null> {
  return prisma.device.findUnique({
    where: { deviceId: publicId },
    select: {
      agentTokenHash: true,
      companyId: true,
      deviceId: true,
      employeeId: true,
      id: true,
      isActive: true,
    },
  });
}

function unauthorized(): never {
  throw new ApiError("UNAUTHORIZED", "Agent authentication failed.", 401);
}

export async function authenticateDevice(request: Request, findDevice: DeviceLoader = loadDevice): Promise<AuthenticatedDevice> {
  const authorization = request.headers.get("authorization");
  const publicId = request.headers.get("x-device-id")?.trim();
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!publicId || !token) unauthorized();

  const device = await findDevice(publicId);
  if (!device?.isActive) unauthorized();

  const expectedHash = Buffer.from(device.agentTokenHash, "utf8");
  const receivedHash = Buffer.from(hashAgentToken(token), "utf8");

  if (expectedHash.length !== receivedHash.length || !timingSafeEqual(expectedHash, receivedHash)) unauthorized();

  return {
    companyId: device.companyId,
    databaseId: device.id,
    employeeId: device.employeeId,
    publicId: device.deviceId,
  };
}
