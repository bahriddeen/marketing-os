"use client";
import { useEffect, useState } from "react";

export function useRotatingStatus(
  active: boolean,
  messages: string[],
  intervalMs = 2200,
): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndex(0);
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const id = setInterval(() => {
      setIndex((i) => (i + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, messages, intervalMs]);

  if (!active) return "";
  return messages[index] ?? "";
}
