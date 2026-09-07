import { requireSuperAdminContext } from "@/lib/auth";
import { adminHandler } from "@/lib/admin/http";
import { listAdminUsers } from "@/lib/admin/service";
import { parseAdminQuery } from "@/lib/admin/validation";
export const GET = adminHandler(requireSuperAdminContext, (context, request) =>
  listAdminUsers(context, parseAdminQuery(new URL(request.url).searchParams)),
);
import { createAdminUser } from "@/lib/admin/service";
import { createUserSchema } from "@/lib/admin/validation";
import { parseRequestBody } from "@/lib/http/request";
export const POST = adminHandler(
  requireSuperAdminContext,
  async (context, request) =>
    createAdminUser(context, await parseRequestBody(request, createUserSchema)),
  { mutation: true, status: 201 },
);
