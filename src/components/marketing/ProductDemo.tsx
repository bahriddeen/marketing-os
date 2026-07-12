"use client";
import { useEffect, useState } from "react";
import { BookOpen, Calendar, Clapperboard, Check, PenLine } from "lucide-react";
import { CAPTIONS } from "./captions";

const TYPE_INTERVAL_MS = 18;
const HOLD_MS = 1400;
const FADE_MS = 200;
const DWELL_REDUCED_MS = 3500;

const MODULES = [
  {
    label: "Brend bilimlar bazasi · Profil",
    Icon: BookOpen,
    body: "Nomi: Osiyo Coffee\nSohasi: Kafe va restoran\nAuditoriya: Yosh mutaxassislar\nOhangi: Do‘stona va energiyali",
  },
  {
    label: "Kontent reja · Fevral",
    Icon: Calendar,
    body: "1-fevral — Post: Mahsulot afzalliklari\n8-fevral — Reels: Mijoz fikri\n15-fevral — Post: Aksiya e‘loni\n22-fevral — Reels: Jamoa bilan tanishuv",
  },
  {
    label: "Reels generatori · Ssenariy",
    Icon: Clapperboard,
    body: "Boshlanish: Buni bilasizmi?\nSsenariy: Mahsulot afzalliklarini 15 soniyada ko‘rsating.\nOhang: Energiyali va qiziqarli",
  },
  {
    label: "Kopiraiting · Instagram",
    Icon: PenLine,
    body: null as string | null,
  },
];

export default function ProductDemo() {
  const [moduleIndex, setModuleIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const current = MODULES[moduleIndex];
    const body =
      current.body ?? CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const advance = (delay: number) => {
      const fadeOut = setTimeout(() => {
        setVisible(false);
        const next = setTimeout(() => {
          setModuleIndex((i) => (i + 1) % MODULES.length);
          setVisible(true);
        }, FADE_MS);
        timeouts.push(next);
      }, delay);
      timeouts.push(fadeOut);
    };

    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTyped(body);
      setDone(true);
      advance(DWELL_REDUCED_MS);
      return () => timeouts.forEach(clearTimeout);
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
        advance(HOLD_MS);
      }
    }, TYPE_INTERVAL_MS);

    return () => {
      clearInterval(id);
      timeouts.forEach(clearTimeout);
    };
  }, [moduleIndex]);

  const { label, Icon } = MODULES[moduleIndex];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <div
        className={`transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted">
            <Icon size={13} strokeWidth={2} />
            {label}
          </span>
          {done && (
            <span className="flex items-center gap-1 text-xs font-medium text-accent">
              <Check size={14} strokeWidth={2.5} />
              Tayyor
            </span>
          )}
        </div>
        <p className="min-h-[7.5rem] whitespace-pre-wrap text-sm leading-relaxed text-white">
          {typed}
          {!done && <span className="animate-pulse">▍</span>}
        </p>
      </div>
    </div>
  );
}
