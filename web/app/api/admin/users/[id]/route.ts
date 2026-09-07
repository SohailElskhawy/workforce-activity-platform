import { requireSuperAdminContext } from "@/lib/auth";
import { adminHandler } from "@/lib/admin/http";
import { updateAdminUser } from "@/lib/admin/service";
import { updateUserSchema } from "@/lib/admin/validation";
import { parseRequestBody } from "@/lib/http/request";
export const PATCH = adminHandler(
  requireSuperAdminContext,
  async (context, request, route) =>
    updateAdminUser(
      context,
      (await route.params).id ?? "",
      await parseRequestBody(request, updateUserSchema),
    ),
  { mutation: true },
);
