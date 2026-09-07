import { requireSuperAdminContext } from "@/lib/auth";
import { adminHandler } from "@/lib/admin/http";
import { adminOverview } from "@/lib/admin/service";
export const GET = adminHandler(requireSuperAdminContext, (context) =>
  adminOverview(context),
);
