"use client";
import { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Yorug' mavzu" },
  { value: "dark", icon: Moon, label: "Tungi mavzu" },
  { value: "system", icon: Monitor, label: "Tizim mavzusi" },
];

function applyTheme(theme: Theme) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem("theme");
  } else {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return "system";
  });

  function handleSelect(value: Theme) {
    setTheme(value);
    applyTheme(value);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Mavzu"
      className="inline-flex items-center gap-0.5 rounded-[0.625rem] border border-line bg-surface p-0.5"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => handleSelect(value)}
            className={`flex items-center justify-center rounded-[0.5rem] p-1.5 transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-ink"
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
