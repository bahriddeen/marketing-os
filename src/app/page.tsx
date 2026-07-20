import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HeroPreview from "@/components/marketing/HeroPreview";
import Button from "@/components/ui/Button";
import { BeamsBackground } from "@/components/ui/BeamsBackground";
import {
  BookOpen,
  Calendar,
  Clapperboard,
  MessageCircle,
  PenLine,
} from "lucide-react";

const MODULE_ROW = [
  { label: "Bilimlar bazasi", Icon: BookOpen },
  { label: "Suhbat", Icon: MessageCircle },
  { label: "Kontent reja", Icon: Calendar },
  { label: "Reels", Icon: Clapperboard },
  { label: "Kopiraiting", Icon: PenLine },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <BeamsBackground className="theme-dark-pinned flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-semibold text-ink">
          AI Marketing OS
        </span>
        <nav className="flex items-center gap-6">
          <Link
            href="/login"
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Kirish
          </Link>
          <Link href="/signup">
            <Button>Bepul boshlash</Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">
        <section className="py-16 text-center md:py-24">
          <h1 className="mx-auto max-w-3xl font-display text-[2.75rem] font-bold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[4rem] md:text-[4.5rem]">
            Brendingizga mos kontentni{" "}
            <span className="text-accent">daqiqalar ichida</span> tayyorlang.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Instagram va Telegram uchun post, reels ssenariysi va reklama
            matni — brend ma‘lumotingiz asosida, soniyalarda.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/signup">
              <Button className="px-6 py-3 text-base">
                Bepul boshlash
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {MODULE_ROW.map(({ label, Icon }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-xs text-muted"
              >
                <Icon size={14} strokeWidth={1.75} />
                {label}
              </span>
            ))}
          </div>
          <HeroPreview />
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <p className="mx-auto max-w-5xl px-6 text-sm text-muted">
          © {new Date().getFullYear()} AI Marketing OS
        </p>
      </footer>
    </BeamsBackground>
  );
}
