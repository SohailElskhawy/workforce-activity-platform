import { z } from "zod";
import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { assertSameOrigin, parseRequestBody } from "@/lib/http/request";
import {
  listAnomalies,
  scanAnomalies,
} from "@/lib/services/anomaly-detection";
import type {
  AnomalySeverity,
  AnomalyStatus,
  AnomalyType,
} from "@/src/generated/prisma/client";

const scanPayloadSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  employeeId: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  try {
    const context = await requireManagerContext();
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId") ?? undefined;
    const projectId = searchParams.get("projectId") ?? undefined;
    const type = (searchParams.get("type") as AnomalyType) ?? undefined;
    const severity =
      (searchParams.get("severity") as AnomalySeverity) ?? undefined;
    const status = (searchParams.get("status") as AnomalyStatus) ?? undefined;
    const startDate = searchParams.get("startDate") ?? undefined;
    const endDate = searchParams.get("endDate") ?? undefined;
    const page = searchParams.get("page")
      ? parseInt(searchParams.get("page")!, 10)
      : 1;
    const pageSize = searchParams.get("pageSize")
      ? parseInt(searchParams.get("pageSize")!, 10)
      : 25;

    const result = await listAnomalies(context, {
      employeeId,
      projectId,
      type,
      severity,
      status,
      startDate,
      endDate,
      page,
      pageSize,
    });

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await requireManagerContext();
    const body = await parseRequestBody(request, scanPayloadSchema);
    const result = await scanAnomalies(context, body);
    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
