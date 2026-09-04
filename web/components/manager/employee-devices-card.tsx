"use client";

import { Laptop, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { postJson } from "@/lib/client/api";
import { formatDate } from "@/lib/formatters";
import { useI18n } from "@/lib/i18n";

export type DeviceSummary = {
  id: string;
  deviceId: string;
  name: string;
  agentVersion: string | null;
  lastSeenAt: Date | string | null;
  isActive: boolean;
  createdAt: Date | string;
};

export function EmployeeDevicesCard({
  devices,
}: {
  devices: DeviceSummary[];
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleRevoke(device: DeviceSummary) {
    if (
      !confirm(
        `Are you sure you want to revoke device "${device.name}" (${device.deviceId})? The agent will no longer be able to submit activity logs.`,
      )
    ) {
      return;
    }

    setRevokingId(device.id);
    try {
      await postJson(`/api/devices/${device.id}/revoke`, {});
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to revoke device.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Laptop className="h-5 w-5 text-muted-foreground" />
          Registered Agent Devices
        </CardTitle>
        <CardDescription>
          Hardware devices enrolled to track active application and idle time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {devices.length ? (
          <div className="divide-y rounded-lg border">
            {devices.map((device) => {
              const lastSeenDate = device.lastSeenAt ? new Date(device.lastSeenAt) : null;
              const lastSeen = lastSeenDate
                ? formatDate(lastSeenDate, locale)
                : "Never";
              // Online if active and heartbeat/activity reported within the last 3 minutes
              const isOnline =
                device.isActive &&
                lastSeenDate !== null &&
                Date.now() - lastSeenDate.getTime() < 3 * 60 * 1000;

              return (
                <div
                  key={device.id}
                  className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{device.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        ({device.deviceId})
                      </span>
                      <Badge variant={device.isActive ? "default" : "secondary"}>
                        {device.isActive ? "Active" : "Revoked"}
                      </Badge>
                      {device.isActive ? (
                        isOnline ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 gap-1"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Online
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-muted text-muted-foreground gap-1"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                            Offline
                          </Badge>
                        )
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last seen: {lastSeen} · Version:{" "}
                      {device.agentVersion ?? "Unknown"}
                    </p>
                  </div>
                  {device.isActive ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={revokingId === device.id}
                      onClick={() => handleRevoke(device)}
                    >
                      <ShieldAlert className="h-4 w-4 mr-1" />
                      Revoke Access
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No devices enrolled for this employee yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
