import { requireSuperAdminContext } from "@/lib/auth";
import { adminHandler } from "@/lib/admin/http";
import {
  adminConfigureIntegration,
  adminDisconnectIntegration,
  adminSyncIntegration,
  adminTestIntegration,
  listAdminIntegrations,
} from "@/lib/admin/service";
import {
  adminIntegrationActionSchema,
  parseAdminQuery,
} from "@/lib/admin/validation";
import { parseRequestBody } from "@/lib/http/request";

export const GET = adminHandler(requireSuperAdminContext, (context, request) =>
  listAdminIntegrations(context, parseAdminQuery(new URL(request.url).searchParams)),
);

export const POST = adminHandler(
  requireSuperAdminContext,
  async (context, request) => {
    const action = await parseRequestBody(request, adminIntegrationActionSchema);
    switch (action.action) {
      case "TEST":
        return adminTestIntegration(context, action.companyId, action.provider);
      case "DISCONNECT":
        return adminDisconnectIntegration(context, action.companyId, action.provider);
      case "SYNC":
        return adminSyncIntegration(
          context,
          action.companyId,
          action.provider,
          action.payload,
        );
      case "CONFIGURE":
        return adminConfigureIntegration(
          context,
          action.companyId,
          action.provider,
          action.credentials,
          action.config,
        );
    }
  },
  { mutation: true },
);
