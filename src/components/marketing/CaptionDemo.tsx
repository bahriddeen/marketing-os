"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

const CAPTION =
  "Yangi mavsum boshlandi 🌿\n\nVetline'da endi uy hayvonlaringiz uchun bepul birinchi konsultatsiya. Joy soni cheklangan — hoziroq yozing!\n\n#vetline #toshkent #uyhayvonlari";

export default function CaptionDemo({
  variant = "full",
}: {
  variant?: "full" | "quiet";
}) {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTyped(CAPTION);
      setDone(true);
      return;
    }

    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(CAPTION.slice(0, i));
      if (i >= CAPTION.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 18);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={
        variant === "full"
          ? "rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]"
          : "rounded-xl border border-white/10 bg-white/5 p-6"
      }
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wide text-muted">
          Kopiraiting · Instagram
        </span>
        {done && (
          <span className="flex items-center gap-1 text-xs font-medium text-accent">
            <Check size={14} strokeWidth={2.5} />
            Tayyor
          </span>
        )}
      </div>
      <p
        className={`min-h-[7.5rem] whitespace-pre-wrap text-sm leading-relaxed ${
          variant === "full" ? "text-ink" : "text-white"
        }`}
      >
        {typed}
        {!done && <span className="animate-pulse">▍</span>}
      </p>
    </div>
  );
}
