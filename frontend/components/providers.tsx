"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: "success" | "warning" | "info";
}

interface ToastContextValue {
  notify: (title: string, description?: string, variant?: "success" | "warning" | "info") => void;
}

const ToastContext = createContext<ToastContextValue>({
  notify: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback(
    (
      title: string,
      description?: string,
      variant: "success" | "warning" | "info" = "success"
    ) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const toastContextValue = useMemo(() => ({ notify }), [notify]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastContext.Provider value={toastContextValue}>
        {children}
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              data-testid="toast-notification"
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-white/10 bg-[#1C2036]/95 px-4 py-3.5 shadow-2xl backdrop-blur-md transition-all"
            >
              {t.variant === "warning" ? (
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              ) : t.variant === "info" ? (
                <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#F5F5FA]">{t.title}</p>
                {t.description && (
                  <p className="text-xs text-[#A1A4B7] mt-0.5 leading-relaxed">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                onClick={() =>
                  setToasts((prev) => prev.filter((item) => item.id !== t.id))
                }
                className="text-[#71758A] hover:text-[#F5F5FA] p-0.5"
                aria-label="Close notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </QueryClientProvider>
  );
}

