import assert from "node:assert/strict";
import test from "node:test";

import {
  addExcludedApplicationSchema,
  normalizeProcessName,
  updateTrackingSettingsSchema,
} from "@/lib/validation/tracking-settings";

test("normalizeProcessName normalizes casing, paths, and adds .exe if missing", () => {
  assert.equal(normalizeProcessName("WhatsApp.exe"), "whatsapp.exe");
  assert.equal(normalizeProcessName("WHATSAPP.EXE"), "whatsapp.exe");
  assert.equal(normalizeProcessName("whatsapp"), "whatsapp.exe");
  assert.equal(
    normalizeProcessName("  C:\\Program Files\\1Password\\1Password.exe  "),
    "1password.exe",
  );
  assert.equal(
    normalizeProcessName("/Applications/Slack/slack"),
    "slack.exe",
  );
});

test("updateTrackingSettingsSchema validates threshold bounds and rejects invalid inputs", () => {
  const valid = updateTrackingSettingsSchema.parse({
    idleThresholdSeconds: 300,
  });
  assert.equal(valid.idleThresholdSeconds, 300);

  // String parsing
  const validString = updateTrackingSettingsSchema.parse({
    idleThresholdSeconds: "600",
  });
  assert.equal(validString.idleThresholdSeconds, 600);

  // Rejects zero
  const zero = updateTrackingSettingsSchema.safeParse({
    idleThresholdSeconds: 0,
  });
  assert.equal(zero.success, false);

  // Rejects negative
  const negative = updateTrackingSettingsSchema.safeParse({
    idleThresholdSeconds: -50,
  });
  assert.equal(negative.success, false);

  // Rejects below 30s
  const belowMin = updateTrackingSettingsSchema.safeParse({
    idleThresholdSeconds: 15,
  });
  assert.equal(belowMin.success, false);

  // Rejects over 14400s (4 hours)
  const tooLong = updateTrackingSettingsSchema.safeParse({
    idleThresholdSeconds: 20000,
  });
  assert.equal(tooLong.success, false);
});

test("addExcludedApplicationSchema normalizes processName and handles optional displayName", () => {
  const valid = addExcludedApplicationSchema.parse({
    processName: "  Telegram.EXE ",
    displayName: " Telegram Desktop ",
  });
  assert.equal(valid.processName, "telegram.exe");
  assert.equal(valid.displayName, "Telegram Desktop");

  const withoutDisplayName = addExcludedApplicationSchema.parse({
    processName: "banking-app",
  });
  assert.equal(withoutDisplayName.processName, "banking-app.exe");
  assert.equal(withoutDisplayName.displayName, null);

  const emptyProcess = addExcludedApplicationSchema.safeParse({
    processName: "   ",
  });
  assert.equal(emptyProcess.success, false);
});
