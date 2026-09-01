import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDurationFromSeconds } from "@/lib/formatters";

type ApplicationBreakdownProps = {
  applications: Array<{ name: string; durationSeconds: number }>;
};

export function ApplicationBreakdown({ applications }: ApplicationBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Applications</CardTitle>
        <CardDescription>Active application time for the selected day.</CardDescription>
      </CardHeader>
      <CardContent>
        {applications.length ? (
          <div className="space-y-3">
            {applications.map((application) => (
              <div className="flex items-center justify-between gap-4 text-sm" key={application.name}>
                <span className="font-medium">{application.name}</span>
                <span className="text-muted-foreground">{formatDurationFromSeconds(application.durationSeconds)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No application activity for this day.</p>}
      </CardContent>
    </Card>
  );
}
