import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default async function HomePage() {
  const ws = await getOrCreateWorkspace();
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="font-display text-3xl font-semibold text-ink">
        {ws.name}
      </h1>
      <p className="leading-relaxed text-muted">
        Brend yarating va kontent generatsiya qiling. Sun‘iy intellekt barcha
        natijalarni brendingiz ma&apos;lumotlari asosida tayyorlaydi.
      </p>
      <div className="flex gap-3">
        <Link href="/app/brands/new">
          <Button>Yangi brend qo‘shish</Button>
        </Link>
        <Link href="/app/copy">
          <Button variant="secondary">Kopiraiting generatsiya qilish</Button>
        </Link>
      </div>
    </div>
  );
}
