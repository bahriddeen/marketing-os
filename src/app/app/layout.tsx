import { getOrCreateWorkspace, getCreditBalance } from "@/lib/workspace";
import { signOut } from "@/app/auth/actions";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ws = await getOrCreateWorkspace();
  const credits = await getCreditBalance(ws.id);
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col gap-2 border-r bg-white p-4">
        <h2 className="mb-4 text-lg font-bold">AI Marketing OS</h2>
        <Link href="/app" className="rounded p-2 hover:bg-gray-100">
          Bosh sahifa
        </Link>
        <Link href="/app/brands" className="rounded p-2 hover:bg-gray-100">
          Brendlar
        </Link>
        <Link href="/app/copy" className="rounded p-2 hover:bg-gray-100">
          Kopiraiting
        </Link>
        <div className="mt-auto space-y-2">
          <p className="rounded bg-gray-100 p-2 text-sm">
            Kreditlar: <b>{credits}</b>
          </p>
          <form action={signOut}>
            <button className="text-sm text-gray-500 underline">Chiqish</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}
