import { signUp } from "@/app/auth/actions";
import Link from "next/link";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        action={signUp}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow"
      >
        <h1 className="text-2xl font-bold">Ro‘yxatdan o‘tish</h1>
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
          minLength={8}
          placeholder="Parol (kamida 8 belgi)"
          className="w-full rounded border p-2"
        />
        <button className="w-full rounded bg-black p-2 text-white">
          Ro‘yxatdan o‘tish
        </button>
        <p className="text-sm">
          Akkauntingiz bormi?{" "}
          <Link className="underline" href="/login">
            Kirish
          </Link>
        </p>
      </form>
    </main>
  );
}
