import { requireSuperAdminContext } from "@/lib/auth";
import { adminHandler } from "@/lib/admin/http";
import { adminSettings, updateAdminSettings } from "@/lib/admin/service";
import { parseRequestBody } from "@/lib/http/request";
import { updateSystemSettingsSchema } from "@/lib/validation/system-settings";

export const GET = adminHandler(requireSuperAdminContext, (context) =>
  adminSettings(context),
);

export const PATCH = adminHandler(
  requireSuperAdminContext,
  async (context, request) =>
    updateAdminSettings(
      context,
      await parseRequestBody(request, updateSystemSettingsSchema),
    ),
  { mutation: true },
);
