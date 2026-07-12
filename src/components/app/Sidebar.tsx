"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Briefcase, CalendarDays, PenLine, LogOut } from "lucide-react";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { signOut } from "@/app/auth/actions";

const NAV = [
  { href: "/app", label: "Bosh sahifa", icon: Home, exact: true },
  { href: "/app/brands", label: "Brendlar", icon: Briefcase, exact: false },
  { href: "/app/plan", label: "Kontent-plan", icon: CalendarDays, exact: false },
  { href: "/app/copy", label: "Kopiraiting", icon: PenLine, exact: false },
];

export default function Sidebar({ credits }: { credits: number }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-full items-center justify-between gap-2 border-b border-line bg-surface p-3 md:sticky md:top-0 md:h-screen md:w-60 md:flex-col md:items-stretch md:justify-start md:gap-1 md:self-start md:overflow-y-auto md:border-b-0 md:border-r md:p-4">
      <Link
        href="/app"
        className="hidden px-2 font-display text-lg font-semibold text-ink md:mb-6 md:block"
      >
        AI Marketing OS
      </Link>
      <nav className="flex items-center gap-1 md:flex-col md:items-stretch md:gap-1">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`flex items-center gap-2.5 rounded-[0.625rem] px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3 md:mt-auto md:flex-col md:items-stretch md:gap-3 md:pt-4">
        <div className="md:self-start">
          <ThemeToggle />
        </div>
        <div className="hidden rounded-[0.625rem] bg-canvas px-3 py-2.5 md:block">
          <p className="text-xs text-muted">Kreditlar</p>
          <p className="font-mono text-lg tabular-nums text-ink">{credits}</p>
        </div>
        <span className="font-mono text-sm tabular-nums text-muted md:hidden">
          {credits}
        </span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" aria-label="Chiqish" className="gap-2 px-3">
            <LogOut size={18} strokeWidth={1.75} />
            <span className="hidden md:inline">Chiqish</span>
          </Button>
        </form>
      </div>
    </aside>
  );
}
