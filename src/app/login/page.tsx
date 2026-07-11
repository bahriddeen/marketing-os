import { signIn } from "@/app/auth/actions";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        action={signIn}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow"
      >
        <h1 className="text-2xl font-bold">Kirish</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="w-full rounded border p-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Parol"
          className="w-full rounded border p-2"
        />
        <button className="w-full rounded bg-black p-2 text-white">
          Kirish
        </button>
        <p className="text-sm">
          Akkaunt yo‘qmi?{" "}
          <Link className="underline" href="/signup">
            Ro‘yxatdan o‘tish
          </Link>
        </p>
      </form>
    </main>
  );
}
