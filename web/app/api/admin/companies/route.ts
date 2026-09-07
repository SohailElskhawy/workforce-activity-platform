import { requireSuperAdminContext } from "@/lib/auth";
import { adminHandler } from "@/lib/admin/http";
import { listAdminCompanies } from "@/lib/admin/service";
import { parseAdminQuery } from "@/lib/admin/validation";
export const GET = adminHandler(requireSuperAdminContext, (context, request) =>
  listAdminCompanies(
    context,
    parseAdminQuery(new URL(request.url).searchParams),
  ),
);
import { saveAdminCompany } from "@/lib/admin/service";
import { companySchema } from "@/lib/admin/validation";
import { parseRequestBody } from "@/lib/http/request";
export const POST = adminHandler(
  requireSuperAdminContext,
  async (context, request) =>
    saveAdminCompany(
      context,
      null,
      await parseRequestBody(request, companySchema),
    ),
  { mutation: true, status: 201 },
);
