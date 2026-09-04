export function normalizeFileName(fileName: string) {
  const normalizedPath = fileName.trim().replaceAll("/", "\\");
  const segments = normalizedPath.split("\\");
  const base = (segments.at(-1) ?? "").toLowerCase();
  return base.replace(/\*+$/, "").trim();
}
