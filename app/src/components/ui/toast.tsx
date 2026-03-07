"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type ToastVariant = "default" | "error" | "success";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  dismissing: boolean;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, variant: ToastVariant = "default") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant, dismissing: false }]);

    // Start exit animation
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, dismissing: true } : t))
      );
    }, 3700);

    // Remove from DOM after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3900);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {typeof window !== "undefined" &&
        toasts.length > 0 &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
                  t.dismissing
                    ? "animate-out fade-out slide-out-to-right-2 duration-200"
                    : "animate-in fade-in slide-in-from-bottom-2 duration-200"
                } ${
                  t.variant === "error"
                    ? "border-destructive/20 bg-destructive/10 text-destructive"
                    : t.variant === "success"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                      : "border-border bg-card text-foreground"
                }`}
              >
                {t.message}
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
