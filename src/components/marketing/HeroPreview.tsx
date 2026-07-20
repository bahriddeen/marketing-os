"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Calendar,
  Check,
  Clapperboard,
  MessageCircle,
  PenLine,
} from "lucide-react";
import { CAPTIONS } from "./captions";

const TYPE_INTERVAL_MS = 18;

const MODULES = [
  {
    id: "kb",
    navLabel: "Bilimlar bazasi",
    demoLabel: "Bilimlar bazasi · Profil",
    Icon: BookOpen,
    body: "Nomi: Osiyo Coffee\nSohasi: Kafe va restoran\nAuditoriya: Yosh mutaxassislar\nOhangi: Do‘stona va energiyali",
  },
  {
    id: "chat",
    navLabel: "Suhbat",
    demoLabel: "Suhbat · Sun‘iy intellekt",
    Icon: MessageCircle,
    body: "Savol: Yozgi aksiya uchun post g‘oyasi kerak.\n\nJavob: Issiq kunlarga mos sovuq ichimliklarga 20% chegirma taklif qiling — energiyali va qisqa ohangda yozing.",
  },
  {
    id: "plan",
    navLabel: "Kontent reja",
    demoLabel: "Kontent reja · Fevral",
    Icon: Calendar,
    body: "1-fevral — Post: Mahsulot afzalliklari\n8-fevral — Reels: Mijoz fikri\n15-fevral — Post: Aksiya e‘loni\n22-fevral — Reels: Jamoa bilan tanishuv",
  },
  {
    id: "reels",
    navLabel: "Reels",
    demoLabel: "Reels generatori · Ssenariy",
    Icon: Clapperboard,
    body: "Boshlanish: Buni bilasizmi?\nSsenariy: Mahsulot afzalliklarini 15 soniyada ko‘rsating.\nOhang: Energiyali va qiziqarli",
  },
  {
    id: "copy",
    navLabel: "Kopiraiting",
    demoLabel: "Kopiraiting · Instagram",
    Icon: PenLine,
    body: CAPTIONS[0],
  },
];

export default function HeroPreview() {
  const [selected, setSelected] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const body = MODULES[selected].body;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTyped(body);
      setDone(true);
      return;
    }

    setTyped("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(body.slice(0, i));
      if (i >= body.length) {
        clearInterval(id);
        setDone(true);
      }
    }, TYPE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [selected]);

  const { demoLabel } = MODULES[selected];

  return (
    <div className="relative mx-auto mt-16 max-w-4xl">
      <div className="relative overflow-hidden rounded-[1.25rem] border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
          <span className="h-2.5 w-2.5 rounded-full bg-line" />
        </div>
        <div className="flex">
          <div className="hidden w-48 shrink-0 border-r border-line bg-surface p-4 md:block">
            <p className="mb-4 px-2 text-sm font-semibold text-ink">
              AI Marketing OS
            </p>
            <nav className="flex flex-col gap-1">
              {MODULES.map(({ id, navLabel, Icon }, index) => {
                const active = index === selected;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelected(index)}
                    className={`flex items-center gap-2.5 rounded-[0.625rem] px-3 py-2 text-left text-sm font-medium transition-colors ${
                      active
                        ? "bg-accent-soft text-accent"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                    {navLabel}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex-1 bg-canvas p-6">
            <div className="rounded-xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wide text-muted">
                  {demoLabel}
                </span>
                {done && (
                  <span className="flex items-center gap-1 text-xs font-medium text-accent">
                    <Check size={14} strokeWidth={2.5} />
                    Tayyor
                  </span>
                )}
              </div>
              <p className="min-h-[7.5rem] whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {typed}
                {!done && <span className="animate-pulse">▍</span>}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
