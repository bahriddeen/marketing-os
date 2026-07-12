import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CaptionDemo from "@/components/marketing/CaptionDemo";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";

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

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
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
        <section className="grid gap-12 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <h1 className="font-display text-[2.5rem] font-bold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[3.5rem]">
              Brendingiz haqida yozing. Tayyor kontentni sun‘iy intellekt yozadi.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
              O‘zbek marketing va SMM mutaxassislari uchun — brend
              ma‘lumotidan Instagram va Telegram‘ga tayyor post, reels
              ssenariysi va reklama matni.
            </p>
            <div className="mt-8">
              <Link href="/signup">
                <Button className="px-6 py-3 text-base">
                  Bepul boshlash
                </Button>
              </Link>
            </div>
          </div>
          <CaptionDemo />
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
    </div>
  );
}
