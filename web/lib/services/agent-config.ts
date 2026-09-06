import type { AuthenticatedDevice } from "@/lib/agent/authenticate";
import { prisma } from "@/lib/prisma";

export type AgentConfigPayload = {
  configVersion: number;
  idleThresholdSeconds: number;
  excludedProcesses: string[];
};

export type AgentConfigStore = {
  getSettings(companyId: string): Promise<{
    configVersion: number;
    idleThresholdSeconds: number;
  } | null>;
  listExcludedProcessNames(companyId: string): Promise<string[]>;
};

function createPrismaStore(): AgentConfigStore {
  return {
    async getSettings(companyId) {
      return prisma.companyTrackingSettings.findUnique({
        where: { companyId },
        select: {
          configVersion: true,
          idleThresholdSeconds: true,
        },
      });
    },
    async listExcludedProcessNames(companyId) {
      const rows = await prisma.excludedApplication.findMany({
        where: { companyId },
        select: { processName: true },
      });
      return rows.map((r) => r.processName);
    },
  };
}

export async function getAgentConfig(
  device: AuthenticatedDevice,
  store?: AgentConfigStore,
): Promise<AgentConfigPayload> {
  const configStore = store ?? createPrismaStore();
  const [settings, excludedProcesses] = await Promise.all([
    configStore.getSettings(device.companyId),
    configStore.listExcludedProcessNames(device.companyId),
  ]);

  return {
    configVersion: settings?.configVersion ?? 1,
    idleThresholdSeconds: settings?.idleThresholdSeconds ?? 300,
    excludedProcesses,
  };
}
