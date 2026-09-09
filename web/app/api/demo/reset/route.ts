import { isDemoModeEnabled } from "@/lib/demo/config";
import { resetDemoFixtures } from "@/lib/demo/fixtures";
import { createDemoPostHandler } from "@/lib/demo/http";

export const POST = createDemoPostHandler(isDemoModeEnabled, resetDemoFixtures);
