import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HeroPreview from "@/components/marketing/HeroPreview";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { BeamsBackground } from "@/components/ui/BeamsBackground";
import { BookOpen, Calendar, Clapperboard, PenLine } from "lucide-react";

const MODULES = [
  {
    title: "Brend bilimlar bazasi",
    body: "Kompaniyangiz haqida bir marta yozing — mahsulotlar, auditoriya, ohang. Sun‘iy intellekt keyingi barcha generatsiyalarda shu ma‘lumotni ishlatadi, qayta tushuntirishga hojat yo‘q.",
  },
  {
    title: "Kontent reja",
    body: "Instagram va Telegram uchun oylik kontent rejasini bir necha daqiqada oling — maqsad va formatga mos, tayyor sarlavhalar bilan.",
  },
  {
    title: "Reels generatori",
    body: "Ssenariy, boshlanish jumlasi va ovoz ohangi — reels uchun tayyor g‘oyalar, brendingiz uslubida.",
  },
  {
    title: "Kopiraiting",
    body: "Post, reklama matni yoki SMS — formatga mos, sotuvga yo‘naltirilgan matnlarni soniyalarda yarating.",
  },
];

const MODULE_ROW = [
  { label: "Bilimlar bazasi", Icon: BookOpen },
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
    <BeamsBackground className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-semibold text-ink">
          AI Marketing OS
        </span>
        <nav className="flex items-center gap-6">
          <ThemeToggle />
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
            Brendingiz haqida yozing — tayyor kontentni{" "}
            <span className="text-accent">sun‘iy intellekt</span> yozadi.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
            O‘zbek marketing va SMM mutaxassislari uchun — brend
            ma‘lumotidan Instagram va Telegram‘ga tayyor post, reels
            ssenariysi va reklama matni.
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

        <section className="grid gap-8 border-t border-line py-16 sm:grid-cols-2">
          {MODULES.map((m) => (
            <div key={m.title}>
              <h2 className="font-display text-xl font-semibold text-ink">
                {m.title}
              </h2>
              <p className="mt-2 leading-relaxed text-muted">{m.body}</p>
            </div>
          ))}
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
