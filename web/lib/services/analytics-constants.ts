export type ActivityCategory =
  | "ENGINEERING_CAD"
  | "OFFICE_DOCS"
  | "COMMUNICATION"
  | "DEV_TECHNICAL"
  | "BROWSING_RESEARCH"
  | "OTHER";

export const CATEGORY_LABELS: Record<
  ActivityCategory,
  { en: string; tr: string; color: string }
> = {
  ENGINEERING_CAD: {
    en: "Engineering & CAD",
    tr: "Mühendislik ve CAD",
    color: "#0284c7", // Sky 600
  },
  OFFICE_DOCS: {
    en: "Office & Documentation",
    tr: "Ofis ve Dokümantasyon",
    color: "#10b981", // Emerald 500
  },
  COMMUNICATION: {
    en: "Communication & Meetings",
    tr: "İletişim ve Toplantı",
    color: "#8b5cf6", // Violet 500
  },
  DEV_TECHNICAL: {
    en: "Technical & Tools",
    tr: "Teknik ve Araçlar",
    color: "#f59e0b", // Amber 500
  },
  BROWSING_RESEARCH: {
    en: "Web & Research",
    tr: "Web ve Araştırma",
    color: "#06b6d4", // Cyan 500
  },
  OTHER: {
    en: "Other Applications",
    tr: "Diğer Uygulamalar",
    color: "#6b7280", // Gray 500
  },
};
