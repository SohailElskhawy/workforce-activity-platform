import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = { value: string };

const destructiveStatuses = new Set(["BLOCKED", "CANCELLED", "ARCHIVED"]);
const secondaryStatuses = new Set(["PLANNED", "TODO", "ON_HOLD", "REVIEW"]);

export function StatusBadge({ value }: StatusBadgeProps) {
  const variant = destructiveStatuses.has(value)
    ? "destructive"
    : secondaryStatuses.has(value)
      ? "secondary"
      : "default";

  return <Badge variant={variant}>{value.replaceAll("_", " ")}</Badge>;
}
