import { getOrCreateWorkspace } from "@/lib/workspace";
import Link from "next/link";

export default async function HomePage() {
  const ws = await getOrCreateWorkspace();
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">{ws.name}</h1>
      <p className="text-gray-600">
        Brend yarating va kontent generatsiya qiling. AI barcha natijalarni
        brendingiz ma&apos;lumotlari asosida tayyorlaydi.
      </p>
      <div className="flex gap-3">
        <Link
          href="/app/brands/new"
          className="rounded bg-black px-4 py-2 text-white"
        >
          Yangi brend qo‘shish
        </Link>
        <Link
          href="/app/copy"
          className="rounded border px-4 py-2"
        >
          Kopiraiting generatsiya qilish
        </Link>
      </div>
    </div>
  );
}
