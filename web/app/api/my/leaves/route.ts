import { requireEmployeeContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { listOwnEmployeeLeavesWithStore } from "@/lib/services/leaves";

export async function GET() {
  try {
    return ok(await listOwnEmployeeLeavesWithStore(await requireEmployeeContext()));
  } catch (error) {
    return handleRouteError(error);
  }
}
