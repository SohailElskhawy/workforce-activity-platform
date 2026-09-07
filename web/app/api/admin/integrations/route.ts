import { requireSuperAdminContext } from "@/lib/auth";
import { adminHandler } from "@/lib/admin/http";
import { adminIntegrations } from "@/lib/admin/service";
export const GET = adminHandler(requireSuperAdminContext, (context) =>
  adminIntegrations(context),
);
