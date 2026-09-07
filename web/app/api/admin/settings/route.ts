import { requireSuperAdminContext } from "@/lib/auth";
import { adminHandler } from "@/lib/admin/http";
import { adminSettings } from "@/lib/admin/service";
export const GET = adminHandler(requireSuperAdminContext, (context) =>
  adminSettings(context),
);
