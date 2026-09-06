"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastVariant = "default" | "success" | "destructive" | "info";

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  toast: (options: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
  success: (description: string, title?: string) => string;
  error: (description: string, title?: string) => string;
  info: (description: string, title?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({
      description,
      duration = 4000,
      title,
      variant = "default",
    }: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${++toastCounter}`;
      const newToast: ToastItem = {
        id,
        title,
        description,
        variant,
        duration,
      };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (description: string, title?: string) => {
      return toast({ description, title, variant: "success" });
    },
    [toast],
  );

  const error = useCallback(
    (description: string, title?: string) => {
      return toast({ description, title, variant: "destructive" });
    },
    [toast],
  );

  const info = useCallback(
    (description: string, title?: string) => {
      return toast({ description, title, variant: "info" });
    },
    [toast],
  );

  const value = useMemo(
    () => ({
      toasts,
      toast,
      dismiss,
      success,
      error,
      info,
    }),
    [toasts, toast, dismiss, success, error, info],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toasts: [],
      toast: () => "",
      dismiss: () => undefined,
      success: () => "",
      error: () => "",
      info: () => "",
    };
  }
  return context;
}
