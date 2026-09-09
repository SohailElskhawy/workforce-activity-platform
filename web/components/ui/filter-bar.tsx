"use client";

import { RotateCcw, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

export function FilterBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}
      role="search"
    >
      {children}
    </div>
  );
}

export function FilterSearch({
  ariaLabel,
  className = "",
  onChange,
  onClear,
  placeholder,
  value,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <div className={`relative min-w-[200px] flex-1 sm:max-w-xs ${className}`}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
      />
      <Input
        aria-label={ariaLabel ?? placeholder ?? t.common.search}
        className="h-9 pl-9 pr-8 text-sm"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t.common.search}
        type="search"
        value={value}
      />
      {value ? (
        <button
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function FilterSelect({
  allLabel,
  ariaLabel,
  className = "",
  onValueChange,
  options,
  placeholder,
  value,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  allLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <Select
      aria-label={ariaLabel ?? placeholder}
      items={[
        { label: allLabel ?? t.common.all, value: "__ALL__" },
        ...options,
      ]}
      onValueChange={(val) => {
        onValueChange(val === "__ALL__" ? "" : (val ?? ""));
      }}
      value={value === "" ? "__ALL__" : value}
    >
      <SelectTrigger className={`h-9 min-w-[140px] text-sm ${className}`}>
        <SelectValue placeholder={placeholder ?? t.common.filter} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__ALL__">{allLabel ?? t.common.all}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FilterReset({
  className = "",
  disabled,
  onReset,
}: {
  onReset: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <Button
      className={`h-9 gap-1.5 text-xs text-slate-600 hover:text-slate-900 ${className}`}
      disabled={disabled}
      onClick={onReset}
      size="sm"
      type="button"
      variant="ghost"
    >
      <RotateCcw className="size-3.5" />
      <span>{t.common.clearFilters}</span>
    </Button>
  );
}
