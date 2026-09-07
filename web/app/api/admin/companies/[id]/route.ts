import { requireSuperAdminContext } from "@/lib/auth";
import { adminHandler } from "@/lib/admin/http";
import { saveAdminCompany, getAdminCompany } from "@/lib/admin/service";
import { companySchema } from "@/lib/admin/validation";
import { parseRequestBody } from "@/lib/http/request";
export const PATCH = adminHandler(
  requireSuperAdminContext,
  async (context, request, route) =>
    saveAdminCompany(
      context,
      (await route.params).id ?? "",
      await parseRequestBody(request, companySchema),
    ),
  { mutation: true },
);
export const GET = adminHandler(
  requireSuperAdminContext,
  async (context, _request, route) =>
    getAdminCompany(context, (await route.params).id ?? ""),
);
