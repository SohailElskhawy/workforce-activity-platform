import { Badge } from "@/components/ui/badge";

type PriorityBadgeProps = { value: "LOW" | "MEDIUM" | "HIGH" | "URGENT" };

export function PriorityBadge({ value }: PriorityBadgeProps) {
  return <Badge variant={value === "URGENT" || value === "HIGH" ? "destructive" : "outline"}>{value}</Badge>;
}
