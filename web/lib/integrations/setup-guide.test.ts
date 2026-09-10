import assert from "node:assert/strict";
import test from "node:test";

import {
  getIntegrationSetupGuide,
  type IntegrationGuideCopy,
  type IntegrationGuideProvider,
} from "@/lib/integrations/setup-guide";

const copy: IntegrationGuideCopy = {
  clickUp: {
    intro: "Use a ClickUp account that can access the workspace you want to connect.",
    steps: ["Sign in to your ClickUp account", "Open Apps", "Create and copy an API token"],
  },
  clockify: {
    intro: "Use the Clockify account that owns the workspace you want to import.",
    steps: ["Sign in to your Clockify account", "Open Profile settings", "Copy your API key"],
  },
  kolayIk: {
    intro: "Ask your HR administrator to create a token with employee and department access.",
    steps: ["Sign in to the Kolay İK account", "Open Developer settings", "Create and copy an API token"],
  },
};

test("each integration guide gives a non-technical user a provider link and actionable steps", () => {
  const expectedUrls: Array<[IntegrationGuideProvider, string]> = [
    ["CLICKUP", "https://app.clickup.com"],
    ["CLOCKIFY", "https://app.clockify.me"],
    ["KOLAY_IK", "https://app.kolayik.com/settings/developer-settings"],
  ];

  for (const [provider, expectedUrl] of expectedUrls) {
    const guide = getIntegrationSetupGuide(provider, copy);

    assert.equal(guide.openUrl, expectedUrl);
    assert.ok(guide.intro.length > 20);
    assert.equal(guide.steps.length, 3);
    assert.ok(guide.steps.every((step) => step.length > 8));
  }
});
