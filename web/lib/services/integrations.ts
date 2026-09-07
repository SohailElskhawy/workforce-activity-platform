import { assertRole, type AuthContext } from "@/lib/auth-context";
import { writeAudit, type AuditEntry } from "@/lib/audit/log";
import { decryptJson, encryptJson } from "@/lib/crypto/secret";
import { ApiError } from "@/lib/http/errors";
import { prisma } from "@/lib/prisma";
import type {
  IntegrationProvider,
  IntegrationStatus,
  Prisma,
} from "@/src/generated/prisma/client";

export type IntegrationRecord = {
  id: string;
  companyId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  encryptedCredentials: string | null;
  config: Prisma.JsonValue | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type IntegrationMappingRecord = {
  id: string;
  companyId: string;
  provider: IntegrationProvider;
  externalEntityType: string;
  externalId: string;
  internalEntityType: string;
  internalId: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicIntegrationView = {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  isConfigured: boolean;
  config: Record<string, unknown> | null;
  lastSyncAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

export type IntegrationStore = {
  findIntegration(
    companyId: string,
    provider: IntegrationProvider
  ): Promise<IntegrationRecord | null>;
  upsertIntegration(
    companyId: string,
    provider: IntegrationProvider,
    data: {
      status?: IntegrationStatus;
      encryptedCredentials?: string | null;
      config?: Prisma.InputJsonValue | null;
      lastSyncAt?: Date | null;
      lastError?: string | null;
    }
  ): Promise<IntegrationRecord>;
  deleteIntegration(
    companyId: string,
    provider: IntegrationProvider
  ): Promise<void>;
  listCompanyIntegrations(companyId: string): Promise<IntegrationRecord[]>;
  findMapping(
    companyId: string,
    provider: IntegrationProvider,
    externalEntityType: string,
    externalId: string
  ): Promise<IntegrationMappingRecord | null>;
  findMappingByInternal(
    companyId: string,
    provider: IntegrationProvider,
    internalEntityType: string,
    internalId: string
  ): Promise<IntegrationMappingRecord | null>;
  upsertMapping(
    companyId: string,
    provider: IntegrationProvider,
    externalEntityType: string,
    externalId: string,
    internalEntityType: string,
    internalId: string,
    metadata?: Prisma.InputJsonValue | null
  ): Promise<IntegrationMappingRecord>;
  writeAudit(entry: AuditEntry): Promise<void>;
};

export const defaultIntegrationStore: IntegrationStore = {
  async findIntegration(companyId, provider) {
    return prisma.integration.findUnique({
      where: {
        companyId_provider: {
          companyId,
          provider,
        },
      },
    });
  },
  async upsertIntegration(companyId, provider, data) {
    return prisma.integration.upsert({
      where: {
        companyId_provider: {
          companyId,
          provider,
        },
      },
      create: {
        companyId,
        provider,
        status: data.status ?? "NOT_CONFIGURED",
        encryptedCredentials: data.encryptedCredentials,
        config: data.config ?? undefined,
        lastSyncAt: data.lastSyncAt,
        lastError: data.lastError,
      },
      update: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.encryptedCredentials !== undefined
          ? { encryptedCredentials: data.encryptedCredentials }
          : {}),
        ...(data.config !== undefined
          ? { config: data.config ?? undefined }
          : {}),
        ...(data.lastSyncAt !== undefined ? { lastSyncAt: data.lastSyncAt } : {}),
        ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
      },
    });
  },
  async deleteIntegration(companyId, provider) {
    await prisma.integration.deleteMany({
      where: {
        companyId,
        provider,
      },
    });
  },
  async listCompanyIntegrations(companyId) {
    return prisma.integration.findMany({
      where: { companyId },
    });
  },
  async findMapping(companyId, provider, externalEntityType, externalId) {
    return prisma.integrationMapping.findUnique({
      where: {
        companyId_provider_externalEntityType_externalId: {
          companyId,
          provider,
          externalEntityType,
          externalId,
        },
      },
    });
  },
  async findMappingByInternal(
    companyId,
    provider,
    internalEntityType,
    internalId
  ) {
    return prisma.integrationMapping.findFirst({
      where: {
        companyId,
        provider,
        internalEntityType,
        internalId,
      },
    });
  },
  async upsertMapping(
    companyId,
    provider,
    externalEntityType,
    externalId,
    internalEntityType,
    internalId,
    metadata
  ) {
    return prisma.integrationMapping.upsert({
      where: {
        companyId_provider_externalEntityType_externalId: {
          companyId,
          provider,
          externalEntityType,
          externalId,
        },
      },
      create: {
        companyId,
        provider,
        externalEntityType,
        externalId,
        internalEntityType,
        internalId,
        metadata: metadata ?? undefined,
      },
      update: {
        internalEntityType,
        internalId,
        metadata: metadata ?? undefined,
      },
    });
  },
  async writeAudit(entry) {
    await writeAudit(prisma, entry);
  },
};

const ALL_PROVIDERS: IntegrationProvider[] = [
  "CLICKUP",
  "KOLAY_IK",
  "CLOCKIFY",
];

export async function listCompanyIntegrationsWithStore(
  context: AuthContext,
  store: IntegrationStore = defaultIntegrationStore
): Promise<PublicIntegrationView[]> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const companyId = context.companyId;
  const records = await store.listCompanyIntegrations(companyId);
  const byProvider = new Map(records.map((r) => [r.provider, r]));

  return ALL_PROVIDERS.map((provider) => {
    const found = byProvider.get(provider);
    if (!found) {
      return {
        provider,
        status: "NOT_CONFIGURED",
        isConfigured: false,
        config: null,
        lastSyncAt: null,
        lastError: null,
        updatedAt: null,
      };
    }

    return {
      provider: found.provider,
      status: found.status,
      isConfigured: Boolean(found.encryptedCredentials),
      config: (found.config as Record<string, unknown>) ?? null,
      lastSyncAt: found.lastSyncAt ? found.lastSyncAt.toISOString() : null,
      lastError: found.lastError,
      updatedAt: found.updatedAt ? found.updatedAt.toISOString() : null,
    };
  });
}

export async function getIntegrationWithStore(
  context: AuthContext,
  provider: IntegrationProvider,
  store: IntegrationStore = defaultIntegrationStore
): Promise<PublicIntegrationView> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const record = await store.findIntegration(context.companyId, provider);
  if (!record) {
    return {
      provider,
      status: "NOT_CONFIGURED",
      isConfigured: false,
      config: null,
      lastSyncAt: null,
      lastError: null,
      updatedAt: null,
    };
  }

  return {
    provider: record.provider,
    status: record.status,
    isConfigured: Boolean(record.encryptedCredentials),
    config: (record.config as Record<string, unknown>) ?? null,
    lastSyncAt: record.lastSyncAt ? record.lastSyncAt.toISOString() : null,
    lastError: record.lastError,
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : null,
  };
}

export async function getDecryptedCredentialsWithStore<T = Record<string, unknown>>(
  companyId: string,
  provider: IntegrationProvider,
  store: IntegrationStore = defaultIntegrationStore
): Promise<{ credentials: T; config: Record<string, unknown> | null } | null> {
  const record = await store.findIntegration(companyId, provider);
  if (!record || !record.encryptedCredentials) {
    return null;
  }

  try {
    const credentials = decryptJson<T>(record.encryptedCredentials);
    return {
      credentials,
      config: (record.config as Record<string, unknown>) ?? null,
    };
  } catch (error) {
    return null;
  }
}

export async function configureIntegrationWithStore(
  context: AuthContext,
  provider: IntegrationProvider,
  credentials: Record<string, unknown>,
  config: Record<string, unknown> | undefined,
  store: IntegrationStore = defaultIntegrationStore
): Promise<PublicIntegrationView> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const encryptedCredentials = encryptJson(credentials);

  const updated = await store.upsertIntegration(context.companyId, provider, {
    status: "CONNECTED",
    encryptedCredentials,
    config: (config ?? {}) as Prisma.InputJsonValue,
    lastError: null,
  });

  // Audit event - explicitly NEVER include credentials
  await store.writeAudit({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "INTEGRATION_CONFIGURED",
    entityType: "Integration",
    entityId: updated.id,
    metadata: {
      provider,
      hasConfig: Boolean(config && Object.keys(config).length > 0),
    },
  });

  return {
    provider: updated.provider,
    status: updated.status,
    isConfigured: true,
    config: (updated.config as Record<string, unknown>) ?? null,
    lastSyncAt: updated.lastSyncAt ? updated.lastSyncAt.toISOString() : null,
    lastError: updated.lastError,
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function disconnectIntegrationWithStore(
  context: AuthContext,
  provider: IntegrationProvider,
  store: IntegrationStore = defaultIntegrationStore
): Promise<void> {
  assertRole(context, ["MANAGER", "SUPER_ADMIN"]);

  const existing = await store.findIntegration(context.companyId, provider);
  if (!existing) {
    return;
  }

  await store.deleteIntegration(context.companyId, provider);

  await store.writeAudit({
    companyId: context.companyId,
    actorUserId: context.userId,
    action: "INTEGRATION_DISCONNECTED",
    entityType: "Integration",
    entityId: existing.id,
    metadata: {
      provider,
    },
  });
}

export async function recordIntegrationSyncStatusWithStore(
  companyId: string,
  provider: IntegrationProvider,
  status: IntegrationStatus,
  error: string | null = null,
  store: IntegrationStore = defaultIntegrationStore
): Promise<void> {
  await store.upsertIntegration(companyId, provider, {
    status,
    lastError: error,
    ...(status === "CONNECTED" ? { lastSyncAt: new Date() } : {}),
  });
}
