"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

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
import { FormAlert, FormField } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast";
import {
  addExcludedApplicationSchema,
  type AddExcludedApplicationInput,
} from "@/lib/validation/tracking-settings";

type AddExclusionForm = z.input<typeof addExcludedApplicationSchema>;

export function AddExclusionDialog() {
  const { formatError, t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<AddExclusionForm, unknown, AddExcludedApplicationInput>({
    defaultValues: {
      processName: "",
      displayName: "",
    },
    resolver: zodResolver(addExcludedApplicationSchema),
  });

  function closeDialog() {
    reset();
    setRequestError(null);
    setOpen(false);
  }

  async function onSubmit(values: AddExcludedApplicationInput) {
    setRequestError(null);
    try {
      await postJson("/api/settings/tracking/exclusions", values);
      toast({
        title: t.settings.excludedAppsCard.addSuccess,
        variant: "success",
      });
      closeDialog();
      router.refresh();
    } catch (error) {
      setRequestError(formatError(error));
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : closeDialog())}
      open={open}
    >
      <DialogTrigger
        render={
          <Button className="gap-2" size="sm">
            <Plus className="size-4" />
            <span>{t.settings.excludedAppsCard.addAppButton}</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-foreground">
            <ShieldAlert className="size-5 text-primary" />
            <DialogTitle>{t.settings.excludedAppsCard.addModalTitle}</DialogTitle>
          </div>
          <DialogDescription>
            {t.settings.excludedAppsCard.addModalDesc}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4 py-2"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          <FormAlert message={requestError} />

          <FormField
            error={errors.processName?.message}
            htmlFor="process-name"
            label={t.settings.excludedAppsCard.processNameLabel}
            required
          >
            <Input
              id="process-name"
              placeholder={t.settings.excludedAppsCard.processNamePlaceholder}
              {...register("processName")}
              aria-invalid={Boolean(errors.processName)}
              autoFocus
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t.settings.excludedAppsCard.processNameHelp}
            </p>
          </FormField>

          <FormField
            error={errors.displayName?.message}
            htmlFor="display-name"
            label={t.settings.excludedAppsCard.displayNameLabel}
          >
            <Input
              id="display-name"
              placeholder={t.settings.excludedAppsCard.displayNamePlaceholder}
              {...register("displayName")}
              aria-invalid={Boolean(errors.displayName)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t.settings.excludedAppsCard.displayNameHelp}
            </p>
          </FormField>

          <DialogFooter className="gap-2 pt-2">
            <Button
              disabled={isSubmitting}
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              {t.common.cancel}
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? t.common.saving : t.settings.excludedAppsCard.addAppButton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
