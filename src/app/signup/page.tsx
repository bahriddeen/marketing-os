import { signUp } from "@/app/auth/actions";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import Link from "next/link";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthSplitLayout>
      <form action={signUp} className="w-full max-w-sm space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">
            Ro&apos;yxatdan o&apos;tish
          </h1>
          <p className="mt-1 text-sm text-muted">
            Bir necha soniyada boshlang — kredit karta shart emas.
          </p>
        </div>
        {error && (
          <p className="rounded-[0.625rem] border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <label className="block">
          <Label>Elektron pochta</Label>
          <Input name="email" type="email" required placeholder="siz@email.com" />
        </label>
        <label className="block">
          <Label>Parol</Label>
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Kamida 8 belgi"
          />
        </label>
        <Button type="submit" className="w-full">
          Ro&apos;yxatdan o&apos;tish
        </Button>
        <p className="text-center text-sm text-muted">
          Akkauntingiz bormi?{" "}
          <Link className="font-medium text-accent hover:underline" href="/login">
            Kirish
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}
