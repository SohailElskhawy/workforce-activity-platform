import assert from "node:assert/strict";
import test from "node:test";

import {
  formatActivityDifference,
  formatDate,
  formatDurationFromMinutes,
  formatDurationFromSeconds,
} from "@/lib/formatters";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isLocale,
} from "@/lib/i18n/config";
import { formatPlural, formatTemplate } from "@/lib/i18n/format";
import { getServerDictionary } from "@/lib/i18n/server";

test("i18n configuration supports turkish and english with turkish as default", () => {
  assert.equal(DEFAULT_LOCALE, "tr");
  assert.deepEqual(SUPPORTED_LOCALES, ["tr", "en"]);
  assert.equal(isLocale("tr"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("de"), false);
  assert.equal(isLocale(""), false);
});

test("server dictionaries provide complete translations for both locales", async () => {
  const tr = await getServerDictionary("tr");
  const en = await getServerDictionary("en");

  assert.equal(tr.common.save, "Kaydet");
  assert.equal(en.common.save, "Save");
  assert.equal(tr.common.navigation.dashboard, "Kontrol Paneli");
  assert.equal(en.common.navigation.dashboard, "Dashboard");
  assert.equal(tr.status.IN_PROGRESS, "Devam Ediyor");
  assert.equal(en.status.IN_PROGRESS, "In Progress");
  assert.equal(tr.priority.URGENT, "Acil");
  assert.equal(en.priority.URGENT, "Urgent");
});

test("server dictionaries are serializable for the client i18n provider", async () => {
  const [tr, en] = await Promise.all([
    getServerDictionary("tr"),
    getServerDictionary("en"),
  ]);

  assert.doesNotThrow(() => structuredClone(tr));
  assert.doesNotThrow(() => structuredClone(en));
});

test("translation templates interpolate values and preserve singular wording", () => {
  assert.equal(
    formatTemplate("Due in {hours}h", { hours: 4 }),
    "Due in 4h",
  );
  assert.equal(
    formatPlural(
      { one: "{count} agent online", other: "{count} agents online" },
      1,
    ),
    "1 agent online",
  );
  assert.equal(
    formatPlural(
      { one: "{count} agent online", other: "{count} agents online" },
      2,
    ),
    "2 agents online",
  );
});

test("formatters adapt correctly to turkish and english locales", () => {
  const testDate = new Date("2026-06-15T10:30:00Z");

  const trDate = formatDate(testDate, "tr");
  const enDate = formatDate(testDate, "en");
  assert.ok(trDate.includes("Haz") || trDate.includes("2026"));
  assert.ok(enDate.includes("Jun") || enDate.includes("2026"));

  assert.equal(formatDurationFromMinutes(90, "tr"), "1 sa 30 dk");
  assert.equal(formatDurationFromMinutes(90, "en"), "1h 30m");

  assert.equal(formatDurationFromSeconds(125, "tr"), "0 sa 2 dk");
  assert.equal(formatDurationFromSeconds(125, "en"), "0h 2m");

  assert.equal(
    formatActivityDifference(0, "tr"),
    "Manuel ve aktivite süresi eşleşiyor",
  );
  assert.equal(
    formatActivityDifference(0, "en"),
    "Manual and activity time match",
  );

  assert.equal(
    formatActivityDifference(30, "tr"),
    "Aktivite süresine göre 30 dk daha fazla manuel süre",
  );
  assert.equal(
    formatActivityDifference(30, "en"),
    "30m more manual time than activity time",
  );

  assert.equal(
    formatActivityDifference(-45, "tr"),
    "Manuel süreye göre 45 dk daha fazla aktivite süresi",
  );
  assert.equal(
    formatActivityDifference(-45, "en"),
    "45m more activity time than manual time",
  );
});

test("formatErrorMessage localizes backend and validation errors correctly", async () => {
  const { formatErrorMessage } = await import("@/lib/i18n/errors");
  const tr = await getServerDictionary("tr");
  const en = await getServerDictionary("en");

  assert.equal(
    formatErrorMessage("Time entries cannot be in the future.", tr),
    "Süre girişleri gelecekteki bir zamana ait olamaz.",
  );
  assert.equal(
    formatErrorMessage("Time entries cannot be in the future.", en),
    "Time entries cannot be in the future.",
  );

  assert.equal(
    formatErrorMessage("End time must be after start time.", tr),
    "Bitiş zamanı başlangıç zamanından sonra olmalıdır.",
  );
  assert.equal(
    formatErrorMessage("End time must be after start time.", en),
    "End time must be after start time.",
  );

  assert.equal(
    formatErrorMessage("Project not found.", tr),
    "Proje bulunamadı.",
  );
  assert.equal(
    formatErrorMessage("Project not found.", en),
    "Project not found.",
  );

  assert.equal(
    formatErrorMessage("Process name must be a valid executable name ending in .exe", tr),
    "İşlem adı .exe ile biten geçerli bir çalıştırılabilir dosya adı olmalıdır.",
  );
  assert.equal(
    formatErrorMessage("Process name must be a valid executable name ending in .exe", en),
    "Executable name must be a valid process ending in .exe.",
  );

  assert.equal(
    formatErrorMessage("Idle threshold must be at least 30 seconds", tr),
    "Boşta kalma süresi eşiği en az 30 saniye olmalıdır.",
  );
  assert.equal(
    formatErrorMessage("Idle threshold must be at least 30 seconds", en),
    "Idle threshold must be at least 30 seconds.",
  );

  assert.equal(
    formatErrorMessage("This application is already excluded for your company.", tr),
    "Bu uygulama zaten hariç tutulan uygulamalar listenizde yer alıyor.",
  );
  assert.equal(
    formatErrorMessage("This application is already excluded for your company.", en),
    "This application is already in your excluded applications list.",
  );
});

test("server dictionaries provide tracking settings translations for both locales", async () => {
  const tr = await getServerDictionary("tr");
  const en = await getServerDictionary("en");

  assert.equal(tr.settings.title, "Şirket Takip Ayarları");
  assert.equal(en.settings.title, "Company Tracking Settings");
  assert.equal(tr.settings.idleThresholdCard.title, "Boşta Kalma (Idle) Tespiti");
  assert.equal(en.settings.idleThresholdCard.title, "Idle Time Detection");
  assert.equal(tr.settings.excludedAppsCard.title, "Hariç Tutulan Uygulamalar ve Gizlilik");
  assert.equal(en.settings.excludedAppsCard.title, "Excluded Applications & Privacy");
  assert.equal(tr.settings.agentConfigCard.title, "İstemci Yapılandırma Senkronizasyonu");
  assert.equal(en.settings.agentConfigCard.title, "Agent Configuration Synchronization");
});
