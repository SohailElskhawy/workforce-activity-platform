import { requireSuperAdminContext } from "@/lib/auth";
import { adminHandler } from "@/lib/admin/http";
import { listAdminLogs } from "@/lib/admin/service";
import { parseAdminQuery } from "@/lib/admin/validation";
export const GET = adminHandler(requireSuperAdminContext, (context, request) =>
  listAdminLogs(context, parseAdminQuery(new URL(request.url).searchParams)),
);
