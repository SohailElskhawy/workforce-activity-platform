"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function FormAlert({
  message,
  variant = "destructive",
}: {
  message?: string | null;
  variant?: "destructive" | "success";
}) {
  if (!message) return null;

  const isDestructive = variant === "destructive";

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed ${
        isDestructive
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
      role={isDestructive ? "alert" : "status"}
    >
      {isDestructive ? (
        <AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
      ) : (
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 mt-0.5" />
      )}
      <div className="flex-1 min-w-0 font-medium">{message}</div>
    </div>
  );
}

export function FormField({
  children,
  className = "",
  error,
  htmlFor,
  label,
  required = false,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-700" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ml-1 text-rose-500">*</span> : null}
        </Label>
      </div>
      {children}
      {error ? (
        <p className="text-xs font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
