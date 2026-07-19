"use client";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, X } from "lucide-react";

type ToastTone = "success" | "error";
type ToastItem = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<{
  show: (message: string, tone?: ToastTone) => void;
} | null>(null);

let nextId = 0;

const noopSubscribe = () => () => {};

// Server always renders "not mounted"; the client's first (hydration) render
// matches that, then re-renders once actually mounted in the browser. This
// avoids a hydration mismatch from the portal only existing client-side.
function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const mounted = useMounted();

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = nextId++;
      setToasts((items) => [...items, { id, message, tone }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 md:inset-x-auto md:right-4 md:items-end"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-[0.625rem] border border-line bg-surface p-3 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)]"
              >
                {t.tone === "error" ? (
                  <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />
                ) : (
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" />
                )}
                <p className="flex-1 text-ink">{t.message}</p>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Yopish"
                  className="shrink-0 rounded text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
