"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { formatTemplate } from "@/lib/i18n/format";
import { getIntegrationSetupGuide } from "@/lib/integrations/setup-guide";
import type { TranslationDictionary } from "@/lib/i18n/types";
import type { PublicIntegrationView } from "@/lib/services/integrations";
import type { IntegrationProvider } from "@/src/generated/prisma/client";

interface IntegrationsViewProps {
  initialIntegrations: PublicIntegrationView[];
  t: TranslationDictionary;
}

export function IntegrationsView({
  initialIntegrations,
  t,
}: IntegrationsViewProps) {
  const { toast } = useToast();
  const [integrations, setIntegrations] =
    useState<PublicIntegrationView[]>(initialIntegrations);

  // Dialog states
  const [configModalProvider, setConfigModalProvider] =
    useState<IntegrationProvider | null>(null);
  const [guideProvider, setGuideProvider] =
    useState<IntegrationProvider | null>(null);
  const [clockifyImportModalOpen, setClockifyImportModalOpen] = useState(false);

  // Form states
  const [tokenInput, setTokenInput] = useState("");
  const [webhookSecretInput, setWebhookSecretInput] = useState("");
  const [teamIdInput, setTeamIdInput] = useState("");
  const [listIdInput, setListIdInput] = useState("");
  const [workspaceIdInput, setWorkspaceIdInput] = useState("");
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState("");
  const [syncDirectionInput, setSyncDirectionInput] = useState("INBOUND");

  // Clockify import date range state
  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const [clockifyStartDate, setClockifyStartDate] = useState(thirtyDaysAgoStr);
  const [clockifyEndDate, setClockifyEndDate] = useState(todayStr);
  const [clockifyImportResult, setClockifyImportResult] = useState<{
    totalFound: number;
    imported: number;
    skippedDuplicate: number;
    unmapped: number;
    failed: number;
  } | null>(null);

  // Action loading states
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const getIntegration = (provider: IntegrationProvider) =>
    integrations.find((i) => i.provider === provider) || {
      provider,
      status: "NOT_CONFIGURED" as const,
      isConfigured: false,
      config: null,
      lastSyncAt: null,
      lastError: null,
      updatedAt: null,
    };

  const refreshList = async () => {
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data);
      }
    } catch {
      // ignore
    }
  };

  const openConfigModal = (provider: IntegrationProvider) => {
    const integ = getIntegration(provider);
    setConfigModalProvider(provider);
    setTokenInput("");
    setWebhookSecretInput("");
    setTeamIdInput((integ.config?.teamId as string) || "");
    setListIdInput((integ.config?.listId as string) || "");
    setWorkspaceIdInput((integ.config?.workspaceId as string) || "");
    setApiBaseUrlInput((integ.config?.apiBaseUrl as string) || "");
    setSyncDirectionInput(
      (integ.config?.syncDirection as string) || "INBOUND"
    );
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configModalProvider) return;

    setLoadingProvider(configModalProvider);

    try {
      let body: Record<string, unknown> = {};

      if (configModalProvider === "CLICKUP") {
        body = {
          apiToken: tokenInput,
          webhookSecret: webhookSecretInput || undefined,
          teamId: teamIdInput || undefined,
          listId: listIdInput || undefined,
          syncDirection: syncDirectionInput,
        };
      } else if (configModalProvider === "CLOCKIFY") {
        body = {
          apiKey: tokenInput,
          workspaceId: workspaceIdInput || undefined,
        };
      } else if (configModalProvider === "KOLAY_IK") {
        body = {
          apiToken: tokenInput,
          apiBaseUrl: apiBaseUrlInput || undefined,
        };
      }

      const res = await fetch(
        `/api/integrations/${configModalProvider}/configure`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save configuration");
      }

      toast({
        title: t.common.success,
        description: t.integrationsSection.statusConnected,
      });

      setConfigModalProvider(null);
      await refreshList();
    } catch (err: unknown) {
      toast({
        title: t.common.error,
        description: err instanceof Error ? err.message : "Error saving configuration",
        variant: "destructive",
      });
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleTestConnection = async (provider: IntegrationProvider) => {
    setLoadingProvider(`test-${provider}`);
    try {
      const res = await fetch(`/api/integrations/${provider}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Connection test failed");
      }

      toast({
        title: t.common.success,
        description: data.message || "Connection verified successfully",
      });
    } catch (err: unknown) {
      toast({
        title: t.common.error,
        description: err instanceof Error ? err.message : "Connection failed",
        variant: "destructive",
      });
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleSync = async (provider: IntegrationProvider) => {
    setLoadingProvider(`sync-${provider}`);
    try {
      const res = await fetch(`/api/integrations/${provider}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }

      toast({
        title: t.common.success,
        description: `Sync completed successfully.`,
      });

      await refreshList();
    } catch (err: unknown) {
      toast({
        title: t.common.error,
        description: err instanceof Error ? err.message : "Sync error",
        variant: "destructive",
      });
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleClockifyImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const clockify = getIntegration("CLOCKIFY");
    const wsId =
      workspaceIdInput || (clockify.config?.workspaceId as string);

    if (!wsId) {
      toast({
        title: t.common.error,
        description: "Workspace ID is required to import Clockify time entries",
        variant: "destructive",
      });
      return;
    }

    setLoadingProvider("import-clockify");
    setClockifyImportResult(null);

    try {
      const res = await fetch("/api/integrations/CLOCKIFY/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: wsId,
          startDate: new Date(clockifyStartDate).toISOString(),
          endDate: new Date(clockifyEndDate + "T23:59:59.999Z").toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Clockify import failed");
      }

      setClockifyImportResult(data);
      toast({
        title: t.common.success,
        description: `${data.imported} time entries imported successfully.`,
      });

      await refreshList();
    } catch (err: unknown) {
      toast({
        title: t.common.error,
        description: err instanceof Error ? err.message : "Import failed",
        variant: "destructive",
      });
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleDisconnect = async (provider: IntegrationProvider) => {
    if (!confirm(t.integrationsSection.disconnectConfirm)) {
      return;
    }

    setLoadingProvider(`disc-${provider}`);
    try {
      const res = await fetch(`/api/integrations/${provider}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Disconnect failed");
      }

      toast({
        title: t.common.success,
        description: t.integrationsSection.statusNotConfigured,
      });

      await refreshList();
    } catch (err: unknown) {
      toast({
        title: t.common.error,
        description: err instanceof Error ? err.message : "Disconnect failed",
        variant: "destructive",
      });
    } finally {
      setLoadingProvider(null);
    }
  };

  const clickUp = getIntegration("CLICKUP");
  const kolayIk = getIntegration("KOLAY_IK");
  const clockify = getIntegration("CLOCKIFY");
  const activeGuide = guideProvider
    ? getIntegrationSetupGuide(guideProvider, t.integrationsSection.setupGuides)
    : null;

  const renderStatusBadge = (integ: PublicIntegrationView) => {
    if (!integ.isConfigured || integ.status === "NOT_CONFIGURED") {
      return (
        <Badge variant="outline" className="border-slate-300 text-slate-500">
          {t.integrationsSection.statusNotConfigured}
        </Badge>
      );
    }
    if (integ.status === "CONNECTED") {
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
          <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
          {t.integrationsSection.statusConnected}
        </Badge>
      );
    }
    if (integ.status === "ERROR") {
      return (
        <Badge variant="destructive">
          <AlertCircle className="mr-1 h-3.5 w-3.5" />
          {t.integrationsSection.statusError}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <RefreshCw className="mr-1 h-3.5 w-3.5 animate-spin" />
        {t.integrationsSection.statusSyncing}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        {/* CLICKUP CARD */}
        <Card className="flex flex-col justify-between border-slate-200 shadow-xs">
          <div>
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600" />
                  {t.integrationsSection.providerClickUp}
                </CardTitle>
                <CardDescription>
                  {t.integrationsSection.providerClickUpDesc}
                </CardDescription>
              </div>
              {renderStatusBadge(clickUp)}
            </CardHeader>

            <CardContent className="space-y-3 pt-2 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">
                  {t.integrationsSection.lastSyncLabel}:
                </span>
                <span className="font-medium text-slate-800">
                  {clickUp.lastSyncAt
                    ? new Date(clickUp.lastSyncAt).toLocaleString()
                    : t.integrationsSection.neverSynced}
                </span>
              </div>

              {clickUp.config?.listId ? (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">
                    {t.integrationsSection.listIdLabel}:
                  </span>
                  <span className="font-mono text-xs text-slate-700">
                    {String(clickUp.config.listId)}
                  </span>
                </div>
              ) : null}

              {clickUp.lastError ? (
                <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 border border-amber-200">
                  {clickUp.lastError}
                </div>
              ) : null}
            </CardContent>
          </div>

          <CardFooter className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 bg-slate-50/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGuideProvider("CLICKUP")}
            >
              {t.integrationsSection.setupGuide}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openConfigModal("CLICKUP")}
            >
              <Settings2 className="mr-1.5 h-4 w-4" />
              {t.integrationsSection.configureButton}
            </Button>

            {clickUp.isConfigured && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Boolean(loadingProvider)}
                  onClick={() => handleTestConnection("CLICKUP")}
                >
                  {loadingProvider === "test-CLICKUP" ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                  )}
                  {t.integrationsSection.testButton}
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  disabled={Boolean(loadingProvider)}
                  onClick={() => handleSync("CLICKUP")}
                >
                  {loadingProvider === "sync-CLICKUP" ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-1.5 h-4 w-4" />
                  )}
                  {t.integrationsSection.syncButton}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={Boolean(loadingProvider)}
                  onClick={() => handleDisconnect("CLICKUP")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </CardFooter>
        </Card>

        {/* KOLAY IK CARD */}
        <Card className="flex flex-col justify-between border-slate-200 shadow-xs">
          <div>
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-sky-600" />
                  {t.integrationsSection.providerKolayIk}
                </CardTitle>
                <CardDescription>
                  {t.integrationsSection.providerKolayIkDesc}
                </CardDescription>
              </div>
              {renderStatusBadge(kolayIk)}
            </CardHeader>

            <CardContent className="space-y-3 pt-2 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">
                  {t.integrationsSection.lastSyncLabel}:
                </span>
                <span className="font-medium text-slate-800">
                  {kolayIk.lastSyncAt
                    ? new Date(kolayIk.lastSyncAt).toLocaleString()
                    : t.integrationsSection.neverSynced}
                </span>
              </div>

              {kolayIk.lastError ? (
                <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 border border-amber-200">
                  {kolayIk.lastError}
                </div>
              ) : null}
            </CardContent>
          </div>

          <CardFooter className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 bg-slate-50/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGuideProvider("KOLAY_IK")}
            >
              {t.integrationsSection.setupGuide}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openConfigModal("KOLAY_IK")}
            >
              <Settings2 className="mr-1.5 h-4 w-4" />
              {t.integrationsSection.configureButton}
            </Button>

            {kolayIk.isConfigured && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Boolean(loadingProvider)}
                  onClick={() => handleTestConnection("KOLAY_IK")}
                >
                  {loadingProvider === "test-KOLAY_IK" ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                  )}
                  {t.integrationsSection.testButton}
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  disabled={Boolean(loadingProvider)}
                  onClick={() => handleSync("KOLAY_IK")}
                >
                  {loadingProvider === "sync-KOLAY_IK" ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-1.5 h-4 w-4" />
                  )}
                  {t.integrationsSection.syncButton}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={Boolean(loadingProvider)}
                  onClick={() => handleDisconnect("KOLAY_IK")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </CardFooter>
        </Card>

        {/* CLOCKIFY CARD */}
        <Card className="flex flex-col justify-between border-slate-200 shadow-xs">
          <div>
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  {t.integrationsSection.providerClockify}
                </CardTitle>
                <CardDescription>
                  {t.integrationsSection.providerClockifyDesc}
                </CardDescription>
              </div>
              {renderStatusBadge(clockify)}
            </CardHeader>

            <CardContent className="space-y-3 pt-2 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">
                  {t.integrationsSection.lastSyncLabel}:
                </span>
                <span className="font-medium text-slate-800">
                  {clockify.lastSyncAt
                    ? new Date(clockify.lastSyncAt).toLocaleString()
                    : t.integrationsSection.neverSynced}
                </span>
              </div>

              {clockify.config?.workspaceId ? (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">
                    {t.integrationsSection.workspaceLabel}:
                  </span>
                  <span className="font-mono text-xs text-slate-700">
                    {String(clockify.config.workspaceId)}
                  </span>
                </div>
              ) : null}

              {clockify.lastError ? (
                <div className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 border border-amber-200">
                  {clockify.lastError}
                </div>
              ) : null}
            </CardContent>
          </div>

          <CardFooter className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 bg-slate-50/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGuideProvider("CLOCKIFY")}
            >
              {t.integrationsSection.setupGuide}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openConfigModal("CLOCKIFY")}
            >
              <Settings2 className="mr-1.5 h-4 w-4" />
              {t.integrationsSection.configureButton}
            </Button>

            {clockify.isConfigured && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={Boolean(loadingProvider)}
                  onClick={() => handleTestConnection("CLOCKIFY")}
                >
                  {loadingProvider === "test-CLOCKIFY" ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                  )}
                  {t.integrationsSection.testButton}
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  disabled={Boolean(loadingProvider)}
                  onClick={() => {
                    setClockifyImportResult(null);
                    setClockifyImportModalOpen(true);
                  }}
                >
                  <Play className="mr-1.5 h-4 w-4" />
                  {t.integrationsSection.syncButton}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={Boolean(loadingProvider)}
                  onClick={() => handleDisconnect("CLOCKIFY")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </div>

      <Dialog
        open={Boolean(guideProvider)}
        onOpenChange={(open) => !open && setGuideProvider(null)}
      >
        <DialogContent className="sm:max-w-[520px]">
          {guideProvider && activeGuide ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {guideProvider === "CLICKUP"
                    ? t.integrationsSection.providerClickUp
                    : guideProvider === "CLOCKIFY"
                      ? t.integrationsSection.providerClockify
                      : t.integrationsSection.providerKolayIk}{" "}
                  {t.integrationsSection.setupGuide}
                </DialogTitle>
                <DialogDescription>
                  {t.integrationsSection.setupGuideDescription}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <p className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm leading-6 text-sky-900">
                  {activeGuide.intro}
                </p>

                <ol className="space-y-3">
                  {activeGuide.steps.map((step, index) => (
                    <li className="flex items-start gap-3" key={step}>
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="pt-0.5 text-sm leading-5 text-slate-700">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>

                <p className="text-xs leading-5 text-slate-500">
                  {t.integrationsSection.setupGuideSecurity}
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <a
                  className={buttonVariants({ variant: "outline" })}
                  href={activeGuide.openUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {formatTemplate(t.integrationsSection.openProvider, {
                    provider:
                      guideProvider === "CLICKUP"
                        ? t.integrationsSection.providerClickUp
                        : guideProvider === "CLOCKIFY"
                          ? t.integrationsSection.providerClockify
                          : t.integrationsSection.providerKolayIk,
                  })}
                  <ExternalLink className="ml-1.5 h-4 w-4" />
                </a>
                <Button
                  onClick={() => {
                    const provider = guideProvider;
                    setGuideProvider(null);
                    openConfigModal(provider);
                  }}
                  type="button"
                >
                  <Settings2 className="mr-1.5 h-4 w-4" />
                  {t.integrationsSection.readyToConfigure}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* CONFIGURATION DIALOG */}
      <Dialog
        open={Boolean(configModalProvider)}
        onOpenChange={(open) => !open && setConfigModalProvider(null)}
      >
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleSaveConfig}>
            <DialogHeader>
              <DialogTitle>
                {configModalProvider === "CLICKUP" &&
                  t.integrationsSection.providerClickUp}
                {configModalProvider === "CLOCKIFY" &&
                  t.integrationsSection.providerClockify}
                {configModalProvider === "KOLAY_IK" &&
                  t.integrationsSection.providerKolayIk}{" "}
                {t.integrationsSection.configureButton}
              </DialogTitle>
              <DialogDescription>
                Credentials are encrypted with AES-256-GCM at rest and never
                sent back to the client.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="token-input">
                  {configModalProvider === "CLOCKIFY"
                    ? t.integrationsSection.apiKeyLabel
                    : t.integrationsSection.apiTokenLabel}
                </Label>
                <Input
                  id="token-input"
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={
                    configModalProvider &&
                    getIntegration(configModalProvider).isConfigured
                      ? "•••••••••••••••• (Leave blank to keep existing)"
                      : "Paste API token / key here"
                  }
                  required={
                    configModalProvider
                      ? !getIntegration(configModalProvider).isConfigured
                      : true
                  }
                />
              </div>

              {configModalProvider === "CLICKUP" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="webhook-secret-input">
                      {t.integrationsSection.webhookSecretLabel}
                    </Label>
                    <Input
                      id="webhook-secret-input"
                      type="password"
                      value={webhookSecretInput}
                      onChange={(e) => setWebhookSecretInput(e.target.value)}
                      placeholder="e.g. whsec_..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="list-id-input">
                      {t.integrationsSection.listIdLabel}
                    </Label>
                    <Input
                      id="list-id-input"
                      value={listIdInput}
                      onChange={(e) => setListIdInput(e.target.value)}
                      placeholder="e.g. 900200300"
                    />
                  </div>
                </>
              )}

              {configModalProvider === "CLOCKIFY" && (
                <div className="space-y-1.5">
                  <Label htmlFor="workspace-id-input">
                    {t.integrationsSection.workspaceLabel}
                  </Label>
                  <Input
                    id="workspace-id-input"
                    value={workspaceIdInput}
                    onChange={(e) => setWorkspaceIdInput(e.target.value)}
                    placeholder="e.g. 642a8b3f..."
                  />
                </div>
              )}

              {configModalProvider === "KOLAY_IK" && (
                <div className="space-y-1.5">
                  <Label htmlFor="base-url-input">API Base URL (Optional)</Label>
                  <Input
                    id="base-url-input"
                    value={apiBaseUrlInput}
                    onChange={(e) => setApiBaseUrlInput(e.target.value)}
                    placeholder="https://api.kolayik.com/v2"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfigModalProvider(null)}
              >
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={Boolean(loadingProvider)}>
                {loadingProvider ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t.integrationsSection.saveConfig}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CLOCKIFY HISTORICAL IMPORT DIALOG */}
      <Dialog
        open={clockifyImportModalOpen}
        onOpenChange={(open) => !open && setClockifyImportModalOpen(false)}
      >
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleClockifyImport}>
            <DialogHeader>
              <DialogTitle>
                Clockify {t.integrationsSection.syncButton}
              </DialogTitle>
              <DialogDescription>
                Import historical time entries for a specified date range.
                Existing entries and desktop activity data will not be
                overwritten.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="imp-ws-id">
                  {t.integrationsSection.workspaceLabel}
                </Label>
                <Input
                  id="imp-ws-id"
                  value={
                    workspaceIdInput ||
                    (clockify.config?.workspaceId as string) ||
                    ""
                  }
                  onChange={(e) => setWorkspaceIdInput(e.target.value)}
                  placeholder="Clockify Workspace ID"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date-input">
                    {t.integrationsSection.startDateLabel}
                  </Label>
                  <Input
                    id="start-date-input"
                    type="date"
                    value={clockifyStartDate}
                    onChange={(e) => setClockifyStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="end-date-input">
                    {t.integrationsSection.endDateLabel}
                  </Label>
                  <Input
                    id="end-date-input"
                    type="date"
                    value={clockifyEndDate}
                    onChange={(e) => setClockifyEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {clockifyImportResult && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-1">
                  <div className="font-semibold text-slate-900 pb-1 border-b border-slate-200">
                    {t.integrationsSection.importResults}
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-slate-600">
                      {t.integrationsSection.imported}:
                    </span>
                    <span className="font-bold text-emerald-600">
                      {clockifyImportResult.imported}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-slate-600">
                      {t.integrationsSection.skippedDuplicate}:
                    </span>
                    <span className="font-medium text-slate-600">
                      {clockifyImportResult.skippedDuplicate}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-slate-600">
                      {t.integrationsSection.unmapped}:
                    </span>
                    <span className="font-medium text-amber-600">
                      {clockifyImportResult.unmapped}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs py-0.5">
                    <span className="text-slate-600">
                      {t.integrationsSection.failed}:
                    </span>
                    <span className="font-medium text-red-600">
                      {clockifyImportResult.failed}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setClockifyImportModalOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={loadingProvider === "import-clockify"}
              >
                {loadingProvider === "import-clockify" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t.integrationsSection.syncButton}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
