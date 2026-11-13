"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ThemeMode = "dark" | "light" | "system";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: "success" | "warning" | "info";
}

interface ToastContextValue {
  notify: (title: string, description?: string, variant?: "success" | "warning" | "info") => void;
}

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

interface TourContextValue {
  isTourOpen: boolean;
  openTour: () => void;
  closeTour: () => void;
}

const ToastContext = createContext<ToastContextValue>({
  notify: () => {},
});

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

const TourContext = createContext<TourContextValue>({
  isTourOpen: false,
  openTour: () => {},
  closeTour: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useTour() {
  return useContext(TourContext);
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

  // Toast notifications state
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

  // Theme state
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("instantly_theme") as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const resolved =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;

      setResolvedTheme(resolved);

      if (resolved === "light") {
        root.classList.remove("dark");
        root.classList.add("light");
        root.setAttribute("data-theme", "light");
      } else {
        root.classList.remove("light");
        root.classList.add("dark");
        root.setAttribute("data-theme", "dark");
      }
    };

    applyTheme();

    const listener = () => {
      if (theme === "system") applyTheme();
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("instantly_theme", newTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  // Product Tour state
  const [isTourOpen, setIsTourOpen] = useState(false);

  const openTour = useCallback(() => {
    setIsTourOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsTourOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("instantly_tour_completed", "true");
    }
  }, []);

  const toastContextValue = useMemo(() => ({ notify }), [notify]);
  const themeContextValue = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );
  const tourContextValue = useMemo(
    () => ({ isTourOpen, openTour, closeTour }),
    [isTourOpen, openTour, closeTour]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContext.Provider value={themeContextValue}>
        <TourContext.Provider value={tourContextValue}>
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
                  className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)]/95 px-4 py-3.5 shadow-2xl backdrop-blur-md transition-all text-[var(--text-primary)]"
                >
                  {t.variant === "warning" ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  ) : t.variant === "info" ? (
                    <Info className="h-5 w-5 text-[var(--accent)] shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{t.title}</p>
                    {t.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setToasts((prev) => prev.filter((item) => item.id !== t.id))
                    }
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 transition"
                    aria-label="Close notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </ToastContext.Provider>
        </TourContext.Provider>
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}
