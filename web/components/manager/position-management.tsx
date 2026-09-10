"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteJson, postJson } from "@/lib/client/api";
import { formatTemplate } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n";

export type PositionOption = { id: string; name: string };

export function PositionManagement({ positions }: { positions: PositionOption[] }) {
  const router = useRouter();
  const { t, formatError } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createPosition(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/positions", { name });
      setName("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? formatError(cause) : t.hr.createPositionFailed);
    } finally {
      setBusy(false);
    }
  }

  async function deletePosition(position: PositionOption) {
    if (!confirm(formatTemplate(t.hr.deletePositionConfirm, { name: position.name }))) return;
    setBusy(true);
    setError(null);
    try {
      await deleteJson(`/api/positions/${position.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? formatError(cause) : t.hr.deletePositionFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.hr.positions}</CardTitle>
        <CardDescription>{t.hr.positionsDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={createPosition}>
          <Input aria-label={t.hr.positionName} onChange={(event) => setName(event.target.value)} placeholder={t.hr.positionName} value={name} />
          <Button disabled={busy} type="submit"><Plus className="size-4" />{t.hr.add}</Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {positions.length ? (
          <ul className="divide-y rounded-md border">
            {positions.map((position) => (
              <li className="flex items-center justify-between gap-3 p-3 text-sm" key={position.id}>
                <span>{position.name}</span>
                <Button aria-label={`Delete ${position.name}`} disabled={busy} onClick={() => deletePosition(position)} size="icon" type="button" variant="ghost"><Trash2 className="size-4 text-destructive" /></Button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{t.hr.noPositions}</p>}
      </CardContent>
    </Card>
  );
}
