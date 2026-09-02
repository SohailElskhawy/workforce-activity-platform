import type { AuthenticatedDevice } from "@/lib/agent/authenticate";
import type { HeartbeatInput } from "@/lib/agent/schemas";

export type HeartbeatStore = {
  updateDevice(update: {
    id: string;
    agentVersion: string;
    lastSeenAt: Date;
  }): Promise<void>;
};

async function createPrismaStore(): Promise<HeartbeatStore> {
  const { prisma } = await import("@/lib/prisma");

  return {
    async updateDevice(update) {
      await prisma.device.update({
        where: { id: update.id },
        data: {
          agentVersion: update.agentVersion,
          lastSeenAt: update.lastSeenAt,
        },
      });
    },
  };
}

export async function recordHeartbeat(
  device: AuthenticatedDevice,
  input: HeartbeatInput,
  store?: HeartbeatStore,
  now: () => Date = () => new Date(),
) {
  const lastSeenAt = now();
  const heartbeatStore = store ?? (await createPrismaStore());
  await heartbeatStore.updateDevice({
    agentVersion: input.agentVersion,
    id: device.databaseId,
    lastSeenAt,
  });
  return { lastSeenAt };
}
