"use client";

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

export type ConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  isSubmitting?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmationDialog({
  cancelLabel,
  confirmLabel,
  description,
  isSubmitting = false,
  onConfirm,
  onOpenChange,
  open,
  title,
  variant = "destructive",
}: ConfirmationDialogProps) {
  const { t } = useI18n();

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-3">
            {variant === "destructive" ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="size-4" />
              </span>
            ) : null}
            <DialogTitle className="text-lg font-semibold tracking-tight text-slate-950">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-slate-600 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            {cancelLabel ?? t.common.cancel}
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={async () => {
              await onConfirm();
            }}
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
          >
            {isSubmitting
              ? t.common.saving
              : (confirmLabel ?? (variant === "destructive" ? t.common.delete : t.common.confirm))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
