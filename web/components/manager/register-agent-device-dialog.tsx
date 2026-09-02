"use client";

import { Check, Copy, Monitor } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isRegisteredDevice,
  toEnrollmentCredentials,
  type RegisteredDevice,
} from "@/lib/agent/device-registration";
import { ClientRequestError, postJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";

type CredentialField = "deviceId" | "token";

export function RegisterAgentDeviceDialog({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const { formatError, t } = useI18n();
  const defaultName = `${employeeName}'s computer`;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [credentials, setCredentials] = useState<RegisteredDevice | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<CredentialField | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setCredentials(null);
    setName(defaultName);
    setRequestError(null);
    setCopiedField(null);
    setIsSubmitting(false);
  }

  function onOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) reset();
  }

  async function registerDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);
    setIsSubmitting(true);
    try {
      const device = await postJson<RegisteredDevice>("/api/agent/register", {
        employeeId,
        name,
      });
      if (!isRegisteredDevice(device)) {
        throw new ClientRequestError(
          "The device registration response was invalid.",
        );
      }
      setCredentials(device);
    } catch (error) {
      setRequestError(formatError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyCredential(field: CredentialField, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
    } catch {
      setRequestError(
        "Copy is unavailable. Select and copy the value manually.",
      );
    }
  }

  const enrollment = credentials ? toEnrollmentCredentials(credentials) : null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Monitor />
            {t.employees.registerAgentDevice}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        {enrollment ? (
          <>
            <DialogHeader className="min-w-0">
              <DialogTitle className="truncate">{t.employees.registerAgentDevice}</DialogTitle>
              <DialogDescription className="wrap-break-word">
                {t.employees.registerAgentDeviceDesc}
              </DialogDescription>
            </DialogHeader>
            <CredentialFieldView
              label="Device ID"
              onCopy={() => copyCredential("deviceId", enrollment.deviceId)}
              copied={copiedField === "deviceId"}
              value={enrollment.deviceId}
            />
            <CredentialFieldView
              label="Device token"
              onCopy={() => copyCredential("token", enrollment.token)}
              copied={copiedField === "token"}
              value={enrollment.token}
            />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} type="button">
                {t.common.close}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="min-w-0">
              <DialogTitle className="truncate">{t.employees.registerAgentDevice}</DialogTitle>
              <DialogDescription className="wrap-break-word">
                {t.employees.registerAgentDeviceDesc}
              </DialogDescription>
            </DialogHeader>
            <form className="grid gap-4 min-w-0" noValidate onSubmit={registerDevice}>
              <div className="grid gap-2 min-w-0">
                <Label htmlFor="agent-device-name">Device name</Label>
                <Input
                  id="agent-device-name"
                  className="w-full min-w-0"
                  maxLength={160}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </div>
              {requestError ? (
                <p className="text-sm text-destructive">{requestError}</p>
              ) : null}
              <DialogFooter>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? t.projects.creating : t.employees.registerAgentDevice}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CredentialFieldView({
  copied,
  label,
  onCopy,
  value,
}: {
  copied: boolean;
  label: string;
  onCopy: () => void;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input aria-label={label} readOnly value={value} />
        <Button onClick={onCopy} size="icon" type="button" variant="outline">
          {copied ? <Check /> : <Copy />}
          <span className="sr-only">Copy {label}</span>
        </Button>
      </div>
    </div>
  );
}

