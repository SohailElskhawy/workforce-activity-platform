export type IntegrationGuideProvider = "CLICKUP" | "CLOCKIFY" | "KOLAY_IK";

export type IntegrationGuideCopy = {
  clickUp: { intro: string; steps: readonly string[] };
  clockify: { intro: string; steps: readonly string[] };
  kolayIk: { intro: string; steps: readonly string[] };
};

export type IntegrationSetupGuide = {
  intro: string;
  openUrl: string;
  steps: readonly string[];
};

export function getIntegrationSetupGuide(
  provider: IntegrationGuideProvider,
  copy: IntegrationGuideCopy,
): IntegrationSetupGuide {
  switch (provider) {
    case "CLICKUP":
      return {
        ...copy.clickUp,
        openUrl: "https://app.clickup.com",
      };
    case "CLOCKIFY":
      return {
        ...copy.clockify,
        openUrl: "https://app.clockify.me",
      };
    case "KOLAY_IK":
      return {
        ...copy.kolayIk,
        openUrl: "https://app.kolayik.com/settings/developer-settings",
      };
  }
}
