type TimelineLabelActivity = {
  applicationName: string | null;
  fileName: string | null;
  project: { code: string } | null;
  type: string;
};

export function toTimelineLabel(activity: TimelineLabelActivity) {
  if (activity.type === "IDLE") return "Idle";
  if (activity.project) return activity.project.code;
  if (activity.fileName) return "Unmapped";
  return activity.applicationName ?? activity.type;
}

export function projectTrackedPercentage(activeSeconds: number, estimatedHours: number | null) {
  if (!estimatedHours || estimatedHours < 0) return null;
  return Math.min(100, Math.round((activeSeconds / (estimatedHours * 3_600)) * 100));
}
