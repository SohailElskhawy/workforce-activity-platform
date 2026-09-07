import { requireManagerContext } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/http/api-response";
import { generateExecutiveBriefing } from "@/lib/services/analytics-engine";

export async function GET(request: Request) {
  try {
    const context = await requireManagerContext();
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("range") ?? "week") as "today" | "week" | "month";
    const validRange = ["today", "week", "month"].includes(range) ? range : "week";

    const briefing = await generateExecutiveBriefing(context, validRange);
    return ok(briefing);
  } catch (error) {
    return handleRouteError(error);
  }
}
