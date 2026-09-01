export function normalizeFileName(fileName: string) {
  const normalizedPath = fileName.trim().replaceAll("/", "\\");
  const segments = normalizedPath.split("\\");
  return (segments.at(-1) ?? "").toLowerCase();
}
