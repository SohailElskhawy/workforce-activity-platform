import { getAuthSession, toAuthContext } from "@/lib/auth";
import { generateCsv } from "@/lib/export/csv";
import { generateExcel } from "@/lib/export/excel";
import { handleRouteError } from "@/lib/http/api-response";
import { ApiError } from "@/lib/http/errors";
import {
  getReportExportData,
  type ExportType,
} from "@/lib/services/report-exports";

const VALID_EXPORT_TYPES = new Set<ExportType>([
  "employee",
  "project",
  "task",
  "application",
  "time-comparison",
]);

export async function GET(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      throw new ApiError("UNAUTHORIZED", "Authentication is required.", 401);
    }
    const context = toAuthContext(session);

    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get("type");
    if (!rawType || !VALID_EXPORT_TYPES.has(rawType as ExportType)) {
      throw new ApiError(
        "VALIDATION_ERROR",
        `Invalid export type. Allowed: ${[...VALID_EXPORT_TYPES].join(", ")}`,
        400,
      );
    }
    const type = rawType as ExportType;

    const format = (searchParams.get("format") ?? "csv").toLowerCase();
    if (format !== "csv" && format !== "xlsx") {
      throw new ApiError(
        "VALIDATION_ERROR",
        "Invalid format. Allowed: csv, xlsx",
        400,
      );
    }

    const employeeId = searchParams.get("employeeId");
    const projectId = searchParams.get("projectId");
    const taskId = searchParams.get("taskId");
    const day = searchParams.get("day");

    const dataset = await getReportExportData(context, {
      type,
      employeeId,
      projectId,
      taskId,
      day,
    });

    if (format === "xlsx") {
      const excelBuffer = await generateExcel(
        dataset.sheetName,
        dataset.headers,
        dataset.rows,
      );

      return new Response(new Uint8Array(excelBuffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${dataset.filenameBase}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // CSV format
    const csvContent = generateCsv(dataset.headers, dataset.rows);
    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dataset.filenameBase}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
