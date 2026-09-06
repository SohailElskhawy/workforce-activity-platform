"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToast, type ToastItem, type ToastVariant } from "@/lib/toast";

export function ToastContainer() {
  const { dismiss, toasts } = useToast();

  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      aria-relevant="additions text"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 p-4 sm:p-0"
    >
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} onDismiss={() => dismiss(toast.id)} toast={toast} />
      ))}
    </div>
  );
}

function ToastMessage({
  onDismiss,
  toast,
}: {
  onDismiss: () => void;
  toast: ToastItem;
}) {
  const { description, title, variant = "default" } = toast;

  const variantStyles: Record<ToastVariant, { border: string; bg: string; iconClass: string }> = {
    default: {
      border: "border-slate-200",
      bg: "bg-white text-slate-900",
      iconClass: "text-slate-500",
    },
    success: {
      border: "border-emerald-200",
      bg: "bg-white text-slate-900",
      iconClass: "text-emerald-600",
    },
    destructive: {
      border: "border-rose-200",
      bg: "bg-white text-slate-900",
      iconClass: "text-rose-600",
    },
    info: {
      border: "border-sky-200",
      bg: "bg-white text-slate-900",
      iconClass: "text-sky-600",
    },
  };

  const currentStyle = variantStyles[variant] ?? variantStyles.default;

  const IconComponent =
    variant === "success"
      ? CheckCircle2
      : variant === "destructive"
        ? AlertCircle
        : Info;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${currentStyle.border} ${currentStyle.bg} p-3.5 shadow-lg shadow-slate-900/5 transition-all`}
      role={variant === "destructive" ? "alert" : "status"}
    >
      <IconComponent className={`mt-0.5 size-4 shrink-0 ${currentStyle.iconClass}`} />
      <div className="flex-1 min-w-0">
        {title ? (
          <p className="text-sm font-semibold tracking-tight">{title}</p>
        ) : null}
        {description ? (
          <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
        ) : null}
      </div>
      <button
        aria-label="Close notification"
        className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        onClick={onDismiss}
        type="button"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export { ToastProvider, useToast } from "@/lib/toast";
