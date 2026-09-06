"use client";

import { Clock, Save } from "lucide-react";
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
import { FormAlert } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { patchJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

const PRESETS = [
  { labelKey: "preset1m" as const, seconds: 60 },
  { labelKey: "preset2m" as const, seconds: 120 },
  { labelKey: "preset5m" as const, seconds: 300 },
  { labelKey: "preset10m" as const, seconds: 600 },
  { labelKey: "preset15m" as const, seconds: 900 },
  { labelKey: "preset30m" as const, seconds: 1800 },
];

export function IdleThresholdCard({
  initialThresholdSeconds,
}: {
  initialThresholdSeconds: number;
}) {
  const { formatError, t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();

  const [seconds, setSeconds] = useState(initialThresholdSeconds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const formattedMinutes = (seconds / 60).toFixed(1).replace(/\.0$/, "");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setRequestError(null);
    setIsSubmitting(true);

    try {
      await patchJson("/api/settings/tracking", {
        idleThresholdSeconds: Number(seconds),
      });
      toast({
        title: t.settings.idleThresholdCard.saveSuccess,
        variant: "success",
      });
      router.refresh();
    } catch (err) {
      setRequestError(formatError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-primary" />
            <CardTitle>{t.settings.idleThresholdCard.title}</CardTitle>
          </div>
          <Badge variant="secondary">
            {formattedMinutes} {t.settings.idleThresholdCard.minutesLabel} (
            {seconds}s)
          </Badge>
        </div>
        <CardDescription>
          {t.settings.idleThresholdCard.desc}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-6" onSubmit={handleSave}>
          <FormAlert message={requestError} />

          {/* Quick presets */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.settings.idleThresholdCard.presets}
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => {
                const isSelected = seconds === preset.seconds;
                return (
                  <Button
                    key={preset.seconds}
                    className="h-8 text-xs font-medium"
                    onClick={() => setSeconds(preset.seconds)}
                    size="sm"
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                  >
                    {t.settings.idleThresholdCard[preset.labelKey]}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Custom seconds input */}
          <div className="space-y-2">
            <Label htmlFor="idle-threshold-input">
              {t.settings.idleThresholdCard.idleThresholdLabel}
            </Label>
            <div className="flex max-w-sm items-center gap-2">
              <Input
                className="w-36 font-mono"
                id="idle-threshold-input"
                max={14400}
                min={30}
                onChange={(e) => setSeconds(Number(e.target.value) || 0)}
                step={30}
                type="number"
                value={seconds}
              />
              <span className="text-sm font-medium text-muted-foreground">
                {t.settings.idleThresholdCard.secondsLabel} (≈ {formattedMinutes}{" "}
                {t.settings.idleThresholdCard.minutesLabel})
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.settings.idleThresholdCard.idleThresholdHelp}
            </p>
          </div>

          <div className="pt-2">
            <Button
              className="gap-2"
              disabled={isSubmitting || seconds === initialThresholdSeconds}
              type="submit"
            >
              <Save className="size-4" />
              <span>
                {isSubmitting
                  ? t.common.saving
                  : t.settings.idleThresholdCard.saveButton}
              </span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
